# CoolCert

Demo Auth Certificate Issuance Server

A Stageline ("testnet") deployment of the master branch of this repository is available at [https://staging-coolcert.babbage.systems](https://staging-coolcert.babbage.systems)

Having a CoolCert certificate allows you to buy Cool Bytes from [The Byte Shop](https://github.com/p2ppsr/byte-shop)!

There is a [UI for interacting with CoolCert](https://github.com/p2ppsr/coolcert-ui) as well.

## The Cool People Certificate

For this demo, CoolCert issues the Cool People Certificate to anyone who requests it, without performing any due diligence or validation about who they are. In the real world, certifiers should have confidence that certificate subjects are authentic. The Certificate Type ID for the Cool People Certificate is `AGfk/WrT1eBDXpz3mcw386Zww2HmqcIn3uY6x4Af1eo=`. The certificate has a single field, `cool`, which is always `true`.

Adapt this certificate issuance server to your own needs by adding a database with information you've verified, and issuing other types of certificates to people who've met your criteria for being certified.

## Setting Up

Intall Docker, then add a `SERVER_PRIVATE_KEY` to your `docker-compose.yml` file.

Run `docker compose up`. Your CoolCert server will be ready to issue certificates from port **3002**.

## Questions?

Reach out on our [website contact form](https://projectbabbage.com/contact), and we'd be happy to answer your questions or schedule a meeting.

## License

The license for the code in this repository is the Open BSV License.
