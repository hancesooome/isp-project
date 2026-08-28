import { app } from './app.js'

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

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
