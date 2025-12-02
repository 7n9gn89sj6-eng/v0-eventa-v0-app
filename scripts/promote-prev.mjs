#!/usr/bin/env node

/**
 * Vercel Deployment Promotion Helper
 * 
 * This script helps identify the previous production deployment for rollback purposes.
 * It does NOT automatically promote - it prints the command for manual confirmation.
 * 
 * Usage: npm run vercel:promote
 * 
 * IMPORTANT: This script requires manual confirmation before promoting.
 * Always verify the deployment URL and communicate with your team before rolling back.
 */

import { execSync } from 'child_process'

console.log('🔍 Finding previous production deployment...\n')

try {
  // Get list of production deployments as JSON
  const output = execSync('vercel ls --prod --json', { 
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })

  const deployments = JSON.parse(output)

  if (!deployments || !Array.isArray(deployments.deployments)) {
    console.error('❌ Error: Unable to parse deployments list')
    process.exit(1)
  }

  const prodDeployments = deployments.deployments

  if (prodDeployments.length < 2) {
    console.error('❌ Error: Not enough production deployments found')
    console.error('   Need at least 2 deployments to identify "previous" deployment')
    console.error(`   Found: ${prodDeployments.length} deployment(s)`)
    process.exit(1)
  }

  // Sort by creation time (newest first)
  prodDeployments.sort((a, b) => b.created - a.created)

  // Get the previous deployment (second in the list)
  const previousDeployment = prodDeployments[1]
  const currentDeployment = prodDeployments[0]

  console.log('📊 Deployment Information:\n')
  console.log('Current Production:')
  console.log(`  URL:     ${currentDeployment.url}`)
  console.log(`  Created: ${new Date(currentDeployment.created).toISOString()}`)
  console.log(`  State:   ${currentDeployment.state}`)
  console.log()
  console.log('Previous Production:')
  console.log(`  URL:     ${previousDeployment.url}`)
  console.log(`  Created: ${new Date(previousDeployment.created).toISOString()}`)
  console.log(`  State:   ${previousDeployment.state}`)
  console.log()
  console.log('─'.repeat(60))
  console.log()
  console.log('⚠️  MANUAL CONFIRMATION REQUIRED')
  console.log()
  console.log('To promote the previous deployment to production, run:')
  console.log()
  console.log(`  vercel promote ${previousDeployment.url}`)
  console.log()
  console.log('⚠️  This will rollback your production deployment!')
  console.log()
  console.log('Before running this command:')
  console.log('  1. Verify the deployment URL is correct')
  console.log('  2. Communicate with your team')
  console.log('  3. Document the reason for rollback')
  console.log('  4. Consider testing in a preview environment first')
  console.log()

} catch (error) {
  console.error('❌ Error executing vercel command:')
  
  if (error.message.includes('command not found')) {
    console.error('   Vercel CLI is not installed or not in PATH')
    console.error('   Install with: npm install -g vercel')
  } else if (error.stderr) {
    console.error(`   ${error.stderr.toString()}`)
  } else {
    console.error(`   ${error.message}`)
  }
  
  process.exit(1)
}
