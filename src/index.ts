/* eslint-disable @typescript-eslint/no-unused-vars */
import * as dotenv from 'dotenv'
import { CertifierServer, CertifierServerOptions } from './CertifierServer'
import { Setup } from '@bsv/wallet-toolbox'
import { Chain } from '@bsv/wallet-toolbox/out/src/sdk'

dotenv.config()

// Load environment variables
const {
  NODE_ENV = 'development',
  BSV_NETWORK = 'main',
  HTTP_PORT = 3998,
  SERVER_PRIVATE_KEY,
  WALLET_STORAGE_URL
} = process.env

async function setupCertifierServer(): Promise<{
  server: CertifierServer
}> {
  try {
    if (SERVER_PRIVATE_KEY === undefined) {
      throw new Error('SERVER_PRIVATE_KEY must be set')
    }

    const wallet = await Setup.createWalletClientNoEnv({
      chain: BSV_NETWORK as Chain,
      rootKeyHex: SERVER_PRIVATE_KEY,
      storageUrl: WALLET_STORAGE_URL
    })

    // Set up server options
    const serverOptions: CertifierServerOptions = {
      port: Number(HTTP_PORT),
      wallet,
      monetize: false,
      calculateRequestPrice: async () => {
        return 0 // Monetize your server here! Price is in satoshis.
      }
    }
    const server = new CertifierServer({}, serverOptions)

    return {
      server
    }
  } catch (error) {
    console.error('Error setting up Wallet Storage and Monitor:', error)
    throw error
  }
}

// Main function to start the server
(async () => {
  try {
    const context = await setupCertifierServer()
    context.server.start()
  } catch (error) {
    console.error('Error starting server:', error)
  }
})().catch(e => console.error(e))
