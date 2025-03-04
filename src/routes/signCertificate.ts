/* eslint-disable @typescript-eslint/no-unused-vars */
import { Certificate, CertificateFieldNameUnder50Bytes, CreateActionArgs, createNonce, MasterCertificate, PushDrop, Random, SymmetricKey, Utils, VerifiableCertificate, verifyNonce } from '@bsv/sdk'
import { certificateFields } from '../certificates/coolCert'
import { CertifierRoute } from '../CertifierServer'

/*
 * This route handles signCertificate for the acquireCertificate protocol.
 *
 * It validates the certificate signing request (CSR) received from the client,
 * decrypts and validates the field values,
 * and signs the certificate and its encrypted field values.
 *
 * The validated and signed certificate is returned to the client where the client saves their copy.
 */
export const signCertificate: CertifierRoute = {
  type: 'post',
  path: '/signCertificate',
  summary: 'Validate and sign a new certificate.',
  exampleBody: {
    type: 'jVNgF8+rifnz00856b4TkThCAvfiUE4p+t/aHYl1u0c=',
    clientNonce: 'VhQ3UUGl4L76T9v3M2YLd/Es25CEwAAoGTowblLtM3s=',
    fields: {
      cool: 'encrypted_value_here'
    },
    keyring: {
      cool: 'Eb8Nc9euJNuXNDRH4/50EQBbSRWWEJ5AvJKB/BFHNWcGIljSt1jE2RMQJmJPXi/OkaQuJuT0CGduPDlh3WbBtBztWXPzxcgdIifNpkV9Cp4='
    }
  },
  exampleResponse: {
    certificate: {
      type: 'jVNgF8+rifnz00856b4TkThCAvfiUE4p+t/aHYl1u0c=',
      subject: '02a1c81d78f5c404fd34c418525ba4a3b52be35328c30e67234bfcf30eb8a064d8',
      serialNumber: 'C9JwOFjAqOVgLi+lK7HpHlxHyYtNNN/Fgp9SJmfikh0=',
      fields: {
        cool: 'true'
      },
      revocationOutpoint: '000000000000000000000000000000000000000000000000000000000000000000000000',
      certifier: '025384871bedffb233fdb0b4899285d73d0f0a2b9ad18062a062c01c8bdb2f720a',
      signature: '3045022100a613d9a094fac52779b29c40ba6c82e8deb047e45bda90f9b15e976286d2e3a7022017f4dead5f9241f31f47e7c4bfac6f052067a98021281394a5bc859c5fb251cc'
    },
    serverNonce: 'UFX3UUGl4L76T9v3M2YLd/Es25CEwAAoGTowblLtM3s='
  },
  func: async (req, res, server) => {
    try {
      const { clientNonce, type, fields, masterKeyring } = req.body
      // Validate params
      try {
        server.certifierSignCheckArgs(req.body)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid parameters'
        return res.status(400).json({
          status: 'error',
          description: message
        })
      }

      // Verify the client actually created the provided nonce
      await verifyNonce(clientNonce, server.wallet, req.auth.identityKey)

      // Server creates a random nonce that the client can verify
      const serverNonce = await createNonce(server.wallet, req.auth.identityKey)
      // The server computes a serial number from the client and server nonces
      const { hmac } = await server.wallet.createHmac({
        data: Utils.toArray(clientNonce + serverNonce, 'base64'),
        protocolID: [2, 'certificate issuance'],
        keyID: serverNonce + clientNonce,
        counterparty: req.auth.identityKey
      })
      const serialNumber = Utils.toBase64(hmac)

      // Decrypt certificate fields and verify them before signing
      const decryptedFields = await MasterCertificate.decryptFields(
        server.wallet,
        masterKeyring,
        fields,
        req.auth.identityKey
      )

      // Refactored check: Ensure that the "cool" field is present and equals "true"
      if (!decryptedFields.cool || decryptedFields.cool !== 'true') {
        return res.status(400).json({
          status: 'error',
          description: 'Sorry, you are not cool enough!'
        })
      }

      // Create a revocation outpoint (logic omitted for simplicity)
      const revocationTxid = 'not supported'

      const signedCertificate = new Certificate(
        type,
        serialNumber,
        req.auth.identityKey,
        ((await server.wallet.getPublicKey({ identityKey: true })).publicKey),
        `${revocationTxid}.0`,
        fields
      )

      await signedCertificate.sign(server.wallet)

      // Returns signed cert to the requester
      return res.status(200).json({
        certificate: signedCertificate,
        serverNonce
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
