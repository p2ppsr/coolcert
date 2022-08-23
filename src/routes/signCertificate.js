const verifyNonce = require('../utils/verifyNonce')
const { decrypt } = require('@cwi/crypto')
const { Crypto } = require('@peculiar/webcrypto')
const crypto = require('crypto')
global.crypto = new Crypto()
const bsv = require('bsv')
const { getPaymentAddress, getPaymentPrivateKey } = require('sendover')

module.exports = {
  type: 'post',
  path: '/signCertificate',
  summary: 'Use this route to fufill a certificate signing request.',
  parameters: {
    messageType: '',
    type: '',
    clientNonce: '',
    serverSerialNonce: '',
    serverValidationNonce: '',
    validationKey: '',
    serialNumber: '',
    fields: {
      cool: true
    },
    keyring: {}
  },
  exampleResponse: {
  },
  func: async (req, res) => {
    try {
      if (req.body.messageType !== 'certificateSigningRequest') {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_REQUEST',
          description: 'Invalid message type!'
        })
      }
      if (req.body.type !== process.env.CERTIFICATE_TYPE_ID) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_REQUEST',
          description: 'Invalid certificate type ID!'
        })
      }
      // Validate server nonces
      if (!verifyNonce(req.body.serverSerialNonce, process.env.SERVER_PRIVATE_KEY)) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_NONCE',
          description: 'Server serial nonce provided was not created by this server!'
        })
      }
      if (!verifyNonce(req.body.serverValidationNonce, process.env.SERVER_PRIVATE_KEY)) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_NONCE',
          description: 'Server validation nonce provided was not created by this server!'
        })
      }
      // The server checks that the hashes match
      const serialNumberToValidate = crypto.createHash('sha256').update(req.body.clientNonce + req.body.serverSerialNonce).digest('base64')
      if (serialNumberToValidate !== req.body.serialNumber) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_SERIAL_NUMBER',
          description: 'Serial number provided did not match the client and server nonces provided.'
        })
      }
      const validationKeyToValidate = crypto.createHash('sha256').update(req.body.clientNonce + req.body.serverValidationNonce).digest('base64')
      if (validationKeyToValidate !== req.body.validationKey) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_VALIDATION_KEY',
          description: 'Validation key provided did not match the client and server nonces provided.'
        })
      }

      // 3. Check encrypted fields and decrypt them
      const keyring = req.body.keyring
      const decryptedFields = {}
      for (const fieldName in keyring) {
        // 1. Derive their private key:
        const derivedPrivateKeyringKey = getPaymentPrivateKey({
          senderPublicKey: req.body.subject,
          recipientPrivateKey: process.env.SERVER_PRIVATE_KEY,
          invoiceNumber: `2-authrite certificate field encryption cert-${req.body.serialNumber} ${fieldName}`,
          returnType: 'bsv'
        })
        // 2. Derive the sender’s public key:
        const derivedPublicKeyringKey = getPaymentAddress({
          senderPrivateKey: process.env.SERVER_PRIVATE_KEY,
          recipientPublicKey: req.body.subject,
          invoiceNumber: `2-authrite certificate field encryption cert-${req.body.serialNumber} ${fieldName}`,
          returnType: 'bsv'
        })
        // 3. Use the shared secret between the keys from step 1 and step 2 for decryption.
        const sharedSecret = (derivedPublicKeyringKey.point.mul(derivedPrivateKeyringKey).toBuffer().slice(1)).toString('hex')

        // const test = 'password'
        // const passwordAsBuf = Buffer.from(test.padEnd(32, '\0'))
        //   // 1. Encrypted (decryption key) revelation key --> Decrypt it using shared secret
        const decryptionKey = await global.crypto.subtle.importKey(
          'raw',
          Uint8Array.from(Buffer.from(sharedSecret, 'hex')), // Note: convert from base64 unless sent as a buffer
          {
            name: 'AES-GCM'
          },
          true,
          ['decrypt']
        )
        const fieldRevelationKey = await decrypt(new Uint8Array(Buffer.from(req.body.keyring[fieldName], 'base64')), decryptionKey, 'Uint8Array')

        // 2. (decryption key) revelation key --> Decrypt the field using the revelation key
        const fieldRevelationCryptoKey = await global.crypto.subtle.importKey(
          'raw',
          fieldRevelationKey,
          {
            name: 'AES-GCM'
          },
          true,
          ['decrypt']
        )
        // 3. Field
        const fieldValue = await decrypt(new Uint8Array(Buffer.from(req.body.fields[fieldName], 'base64')), fieldRevelationCryptoKey, 'Uint8Array')
        decryptedFields[fieldName] = Buffer.from(fieldValue).toString()
      }

      // 4. TODO: Create an 'actual' spendable revocation outpoint
      const revocationOutpoint = '000000000000000000000000000000000000000000000000000000000000000000000000'

      // 5. Derive the certificate signing public key (sendover)
      const validationPublicKey = bsv.PrivateKey.fromHex(Buffer.from(req.body.validationKey, 'base64').toString('hex')).publicKey.toString()
      const derivedPrivateKey = getPaymentPrivateKey({
        senderPublicKey: validationPublicKey,
        recipientPrivateKey: process.env.SERVER_PRIVATE_KEY,
        invoiceNumber: `2-authrite certificate signature ${process.env.CERTIFICATE_TYPE_ID}-${req.body.serialNumber}`,
        returnType: 'wif'
      })

      // Field validation
      if (decryptedFields.cool !== 'true') {
        return res.status(500).json({
          status: 'error',
          code: 'ERR_NOT_COOL_ENOUGH',
          description: 'Sorry, you are not cool enough!'
        })
      }

      // Create a signed signature to return
      const certificate = {
        type: req.body.type,
        validationKey: req.body.validationKey,
        serialNumber: req.body.serialNumber,
        fields: req.body.fields,
        certifier: bsv.PrivateKey.fromHex(process.env.SERVER_PRIVATE_KEY).publicKey.toString(),
        revocationOutpoint
      }

      // 6. Signs the cert
      const dataToSign = Buffer.from(JSON.stringify(certificate))

      // Construct an object with the fields you know about
      const signature = bsv.crypto.ECDSA.sign(
        bsv.crypto.Hash.sha256(dataToSign),
        bsv.PrivateKey.fromWIF(derivedPrivateKey)
      )
      certificate.signature = signature.toString('hex')

      // 7. Returns signed cert to the requester
      return res.status(200).json({
        status: 'success',
        certificate
      })
    } catch (e) {
      console.error(e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}
