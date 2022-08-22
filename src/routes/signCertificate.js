const verifyNonce = require('../utils/verifyNonce')
const crypto = require('crypto')
const bsv = require('bsv')
const { decrypt } = require('@cwi/crypto')
const { getPaymentAddress, getPaymentPrivateKey } = require('sendover')
// const Ninja = require('utxoninja')
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
    fields: {},
    keyring: {}
  },
  exampleResponse: {
  },
  func: async (req, res) => {
    try {
      // TODO: Refactor to validation function?
      if (req.body.messageType !== 'certificateSigningRequest') {
        res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_REQUEST',
          description: 'Invalid message type!'
        })
      }
      if (req.body.type !== process.env.CERTIFICATE_TYPE_ID) {
        res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_REQUEST',
          description: 'Invalid certificate type ID!'
        })
      }
      // Validate server nonces
      if (!verifyNonce(req.body.serverSerialNonce, process.env.SERVER_PRIVATE_KEY)) {
        res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_NONCE',
          description: 'Server serial nonce provided was not created by this server!'
        })
      }
      if (!verifyNonce(req.body.serverValidationNonce, process.env.SERVER_PRIVATE_KEY)) {
        res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_NONCE',
          description: 'Server validation nonce provided was not created by this server!'
        })
      }
      // The server checks that the hashes match
      const serialNumberToValidate = crypto.createHash('sha256').update(req.body.clientNonce + req.body.serverSerialNonce).digest('base64')
      if (serialNumberToValidate !== req.body.serialNumber) {
        res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_SERIAL_NUMBER',
          description: 'Serial number provided did not match the client and server nonces provided.'
        })
      }
      const validationKeyToValidate = crypto.createHash('sha256').update(req.body.clientNonce + req.body.serverValidationNonce).digest('base64')
      if (validationKeyToValidate !== req.body.validationKey) {
        res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_VALIDATION_KEY',
          description: 'Validation key provided did not match the client and server nonces provided.'
        })
      }

      // 1. Derive their private key:
      const derivedPrivateKeyringKey = getPaymentPrivateKey({
        senderPrivateKey: process.env.SERVER_PRIVATE_KEY,
        recipientPublicKey: req.body.authrite.identityKey, // Is this the correct key?
        invoiceNumber: `2-authrite certificate field encryption ${process.env.CERTIFICATE_TYPE_ID}-${req.body.serialNumber} ${fieldName}`,
        returnType: 'publicKey'
      })
      // 2. Derive the sender’s public key:
      const derivedPublicKeyringKey = getPaymentAddress({
        senderPrivateKey: process.env.SERVER_PRIVATE_KEY,
        recipientPublicKey: req.body.authrite.identityKey, // Is this the correct key?
        invoiceNumber: `2-authrite certificate field encryption ${process.env.CERTIFICATE_TYPE_ID}-${req.body.serialNumber} ${fieldName}`,
        returnType: 'publicKey'
      })
      // 3. Use the shared secret between the keys from step 1 and step 2 for decryption.
      const sharedSecret = derivedPublicKeyringKey.point.mul(derivedPrivateKeyringKey).toBuffer() // ?
      let decryptedKeyring

      // 3. TODO: Check encrypted fields and decrypt them
      // const fieldsToDecrypt = req.body.fields // ?
      // For each CertificateFieldRevelationKeyring key/value pair, decrypt the corresponding field and compare with ?
      // fieldsToDecrypt.forEach(async field => {
      //   const keyAsBuffer = Buffer.from(key, 'base64')
      //   const decryptionKey = await global.crypto.subtle.importKey(
      //     'raw',
      //     new Uint8Array(keyAsBuffer),
      //     {
      //       name: 'AES-GCM'
      //     },
      //     true,
      //     ['decrypt']
      //   )
      //   const decryptedField = await decrypt(new Uint8Array(field), decryptionKey, 'Uint8Array')
      // })
      // 4. TODO: Create a spendable revocation outpoint (using ninja.createTransaction?)
      // 5. Derive the certificate signing public key (sendover)
      const validationPublicKey = bsv.PrivateKey.fromHex(Buffer.from(req.body.validationKey, 'base64').toString('hex')).publicKey.toString()
      const derivedPrivateKey = getPaymentPrivateKey({
        senderPrivateKey: process.env.SERVER_PRIVATE_KEY,
        recipientPublicKey: validationPublicKey,
        invoiceNumber: `2-authrite certificate signature ${process.env.CERTIFICATE_TYPE_ID}-${req.body.serialNumber}`,
        returnType: 'publicKey'
      })
      // 6. Signs the cert
      const dataToSign = Buffer.from(JSON.stringify(req.body)) // TODO: check order after stringify // TODO: Validate what you're signing!!
      const certificate = {
        fields: req.body.fields
      }
      // Construct an object with the fields you know about
      const certifiedSignature = bsv.crypto.ECDSA.sign(
        bsv.crypto.Hash.sha256(dataToSign),
        bsv.PrivateKey.fromWIF(derivedPrivateKey)
      )
      // TODO: Append the signature to the certificate
      // const certificate = {
      //   ...req.body, // Check this // TODO: Create a certificate structure that omits particular things and then send it back after validation.
      //   certifiedSignature,
      //   certifier: bsv.PrivateKey.fromHex(process.env.SERVER_PRIVATE_KEY).publicKey.toString()
      // }
      // 7. Returns signed cert to the requester
      return res.status(200).json({
        status: 'success',
        certificate
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}
