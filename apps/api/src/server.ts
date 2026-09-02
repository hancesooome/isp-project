import { app } from './app.js'
import { logger } from './lib/logger.js'

const DEFAULT_PORT = 3000

function readPort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT
  }

  const port = Number(value)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  return port
}

const port = readPort(process.env.PORT)

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection', { error })
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught server exception', { error })
  process.exit(1)
})

app.listen(port, () => {
  logger.info('API listening', { port })
})
