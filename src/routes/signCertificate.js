const { verifyNonce } = require('cryptononce')
const { Crypto } = require('@peculiar/webcrypto')
const crypto = require('crypto')
global.crypto = new Crypto()
const bsv = require('babbage-bsv')
const { getPaymentPrivateKey } = require('sendover')
const authriteUtils = require('authrite-utils')
const stringify = require('json-stable-stringify')

module.exports = {
  type: 'post',
  path: '/signCertificate',
  summary: 'Use this route to fufill a certificate signing request.',
  parameters: {
    messageType: 'certificateSigningRequest',
    type: '',
    clientNonce: '',
    serverSerialNonce: '',
    serverValidationNonce: '',
    validationKey: '',
    serialNumber: '',
    fields: {
      cool: 'encrypted version of true'
    },
    keyring: {
      cool: 'encrypted field revelation key for the "cool" field'
    }
  },
  exampleResponse: {
    subject: '...',
    '...': 'Fully-signed Authrite certificate'
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

      // Save the sender's identityKey as the subject of the certificate
      req.body.subject = req.authrite.identityKey
      // Check encrypted fields and decrypt them
      const decryptedFields = await authriteUtils.decryptCertificateFields(req.body, req.body.keyring, process.env.SERVER_PRIVATE_KEY)

      /// ///////
      // Certificate Template
      /// ///////
      // This can be replaced with the validated fields you expect to be
      // present in the incoming CSR.
      const expectedFields = {
        cool: 'true'
      }

      if (!Object.keys(decryptedFields).every(x => expectedFields[x] === decryptedFields[x])) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_NOT_COOL_ENOUGH',
          description: 'Sorry, you are not cool enough!'
        })
      }

      // 4. TODO: Create an 'actual' spendable revocation outpoint
      const revocationOutpoint = '000000000000000000000000000000000000000000000000000000000000000000000000'

      // 5. Derive the certificate signing public key (sendover)
      const validationPublicKey = bsv.PrivateKey.fromHex(Buffer.from(req.body.validationKey, 'base64').toString('hex')).publicKey.toString()
      const derivedPrivateKey = getPaymentPrivateKey({
        senderPublicKey: validationPublicKey,
        recipientPrivateKey: process.env.SERVER_PRIVATE_KEY,
        invoiceNumber: `2-authrite certificate signature ${Buffer.from(process.env.CERTIFICATE_TYPE_ID, 'base64').toString('hex')}-${req.body.serialNumber}`,
        returnType: 'wif'
      })

      // Create a signed certificate to return
      const certificate = {
        type: req.body.type,
        subject: req.body.subject,
        validationKey: req.body.validationKey,
        serialNumber: req.body.serialNumber,
        fields: req.body.fields,
        certifier: bsv.PrivateKey
          .fromHex(process.env.SERVER_PRIVATE_KEY)
          .publicKey.toString(),
        revocationOutpoint
      }

      // 6. Signs the cert
      const dataToSign = Buffer.from(stringify(certificate))

      // Construct an object with the fields you know about
      const signature = bsv.crypto.ECDSA.sign(
        bsv.crypto.Hash.sha256(dataToSign),
        bsv.PrivateKey.fromWIF(derivedPrivateKey)
      )
      certificate.signature = signature.toString('hex')

      // 7. Returns signed cert to the requester
      return res.status(200).json(certificate)
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
