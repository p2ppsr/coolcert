async function encryptField(certifier_pub:PublicKey, certificate_type:CertificateTypeID, certificate_serialNumber:CertificateSerialNumber, field_name, value) {
    const keyID = `${certificate_serialNumber} ${field_name}`
    const encrypted_value:EncryptedSomething = await encrypt({
      protocolID: "[2, `authrite certificate field ${certificate_type}`]",
      keyID,
      originator: 'projectbabbage.com',
      plaintext: new TextEncoder().encode(value)
    })
    const certificate_field_revelation_key:PrimaryKey = await getPrimaryKey({
      protocolID: [2, `authrite certificate field ${certificate_type}`],
      keyID,
      counterparty: "self",
      sharedSymmetricKey: true
    })
    const encrypted_certificate_field_revelation_key:EncryptedSomething = await encrypt({
      protocolID: "[2, `authrite certificate field encryption ${certificate_type}`]",
      keyID,
      originator: 'projectbabbage.com',
      counterparty: certifier_pub,
      plaintext: new TextEncoder().encode(certificate_field_revelation_key)
    })
    return {
      field_value: encrypted_value,
      keyring_value: encrypted_certificate_field_revelation_key
    }
  }