#!/usr/bin/env node

/**
 * Production Smoke Test Script
 * 
 * Tests critical endpoints on a production/staging environment.
 * 
 * Usage:
 *   PROD_URL=https://your-domain.com npm run smoke:prod
 * 
 * Or add to .env:
 *   PROD_URL=https://your-domain.com
 */

const PROD_URL = process.env.PROD_URL

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green)
}

function logError(message) {
  log(`✗ ${message}`, colors.red)
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue)
}

async function testStatusEndpoint(url) {
  logInfo(`Testing /api/status endpoint...`)
  
  try {
    const response = await fetch(`${url}/api/status`)
    const data = await response.json()
    
    logInfo(`Response: ${JSON.stringify(data, null, 2)}`)
    
    if (response.status === 200 || data.ok) {
      logSuccess(`/api/status returned valid response (status: ${response.status})`)
      return true
    } else {
      logError(`/api/status returned unexpected response (status: ${response.status})`)
      return false
    }
  } catch (error) {
    logError(`/api/status failed: ${error.message}`)
    return false
  }
}

async function testHomepage(url) {
  logInfo(`Testing homepage...`)
  
  try {
    const response = await fetch(url, { redirect: 'manual' })
    
    if (response.status === 200 || response.status === 302) {
      logSuccess(`Homepage returned ${response.status} (OK)`)
      return true
    } else {
      logError(`Homepage returned unexpected status: ${response.status}`)
      return false
    }
  } catch (error) {
    logError(`Homepage test failed: ${error.message}`)
    return false
  }
}

async function testHealthEnvProtected(url) {
  logInfo(`Testing /api/health/env is protected...`)
  
  try {
    const response = await fetch(`${url}/api/health/env`)
    
    if (response.status !== 200) {
      logSuccess(`/api/health/env is protected (status: ${response.status})`)
      return true
    } else {
      logError(`/api/health/env returned 200 - should be protected in production!`)
      return false
    }
  } catch (error) {
    logError(`/api/health/env test failed: ${error.message}`)
    return false
  }
}

async function main() {
  log('\n=== Production Smoke Test ===\n', colors.yellow)
  
  if (!PROD_URL) {
    logError('PROD_URL environment variable is required')
    logInfo('Usage: PROD_URL=https://your-domain.com npm run smoke:prod')
    process.exit(1)
  }
  
  logInfo(`Testing: ${PROD_URL}\n`)
  
  const results = []
  
  // Run all tests
  results.push(await testStatusEndpoint(PROD_URL))
  console.log('')
  results.push(await testHomepage(PROD_URL))
  console.log('')
  results.push(await testHealthEnvProtected(PROD_URL))
  
  // Summary
  console.log('')
  log('=== Summary ===', colors.yellow)
  const passed = results.filter(Boolean).length
  const total = results.length
  
  if (passed === total) {
    logSuccess(`All ${total} tests passed!`)
    process.exit(0)
  } else {
    logError(`${total - passed} of ${total} tests failed`)
    process.exit(1)
  }
}

main()
