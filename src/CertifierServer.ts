import { WalletInterface } from '@bsv/sdk'
import express, { Request, Response } from 'express'
import { AuthMiddlewareOptions, createAuthMiddleware } from '@bsv/auth-express-middleware'
import { createPaymentMiddleware } from '@bsv/payment-express-middleware'
import * as routes from './routes'

export interface CertifierServerOptions {
  port: number
  wallet: WalletInterface
  monetize: boolean
  calculateRequestPrice?: (req: Request) => number | Promise<number>
}

export interface CertifierRoute {
  type: 'post' | 'get'
  path: string
  summary: string
  parameters?: object
  exampleBody?: object
  exampleResponse: object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  func: (req: Request, res: Response, server: CertifierServer) => Promise<any>
}

export class CertifierServer {
  private readonly app = express()
  private readonly port: number
  wallet: WalletInterface
  private readonly monetize: boolean
  private readonly calculateRequestPrice?: (req: Request) => number | Promise<number>

  constructor(storage: any, options: CertifierServerOptions) {
    this.port = options.port
    this.wallet = options.wallet
    this.monetize = options.monetize
    this.calculateRequestPrice = options.calculateRequestPrice

    this.setupRoutes()
  }

  private setupRoutes(): void {
    this.app.use(express.json({ limit: '30mb' }))

    // This allows the API to be used everywhere when CORS is enforced
    this.app.use((req: Request, res: Response, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Headers', '*')
      res.header('Access-Control-Allow-Methods', '*')
      res.header('Access-Control-Expose-Headers', '*')
      res.header('Access-Control-Allow-Private-Network', 'true')
      if (req.method === 'OPTIONS') {
        // Handle CORS preflight requests to allow cross-origin POST/PUT requests
        res.sendStatus(200)
      } else {
        next()
      }
    })

    // Configure the auth and payment middleware
    this.app.use(createAuthMiddleware({
      wallet: this.wallet
    }))
    if (this.monetize) {
      this.app.use(
        createPaymentMiddleware({
          wallet: this.wallet,
          calculateRequestPrice: async (req) => {
            return 0 //temp
          }
        })
      )
    }

    // Setup the express routes for this server
    const theRoutes: CertifierRoute[] = [
      // routes.verifyAttributes,
      routes.signCertificate,
      // routes.checkVerification,
      // routes.revokeCertificate
    ]

    for (const route of theRoutes) {
      this.app[route.type](`${route.path}`, async (req: Request, res: Response) => {
        return route.func(req, res, this)
      })
    }
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`CertifierServer listening at http://localhost:${this.port}`)
    })
  }

  /**
   * Helper function which checks the arguments for the certificate signing request
   * @param {object} args
   * @throws {Error} if any of the required arguments are missing
   */
  certifierSignCheckArgs(args: { clientNonce: string, type: string, fields: Record<string, string>, masterKeyring: Record<string, string> }): void {
    if (!args.clientNonce) {
      throw new Error('Missing client nonce!')
    }
    if (!args.type) {
      throw new Error('Missing certificate type!')
    }
    if (!args.fields) {
      throw new Error('Missing certificate fields to sign!')
    }
    if (!args.masterKeyring) {
      throw new Error('Missing masterKeyring to decrypt fields!')
    }
  }
}

