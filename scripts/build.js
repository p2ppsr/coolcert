const ejs = require('ejs')
const fs = require('fs')
require('dotenv').config()
const bsv = require('babbage-bsv')
const PUBKEY = bsv
  .PrivateKey.fromString(process.env.SERVER_PRIVATE_KEY)
  .publicKey.toString()

ejs.renderFile(
  'src/templates/documentation.ejs',
  {
    ...process.env,
    routes: require('../src/routes'),
    PUBKEY
  },
  {},
  (err, res) => {
    if (err) {
      throw err
    }
    console.log('Generating API Documentation...')
    fs.writeFileSync('public/index.html', res)
  }
)
