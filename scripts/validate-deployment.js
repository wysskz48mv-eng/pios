#!/usr/bin/env node

const DEPLOYMENT_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}`
  : 'https://pios-coral.vercel.app';

const HEALTH_ENDPOINT = `${DEPLOYMENT_URL}/api/health`;

async function runValidation() {
  console.log('🔍 PIOS Post-Deployment Validation\n');
  
  try {
    const response = await fetch(HEALTH_ENDPOINT);
    const data = await response.json();
    
    console.log('📊 VALIDATION RESULTS\n');
    
    if (data.overall_healthy) {
      console.log('✅ OVERALL: HEALTHY\n');
      console.log(`✅ ${data.personas.total_personas} personas configured`);
      console.log(`✅ ${data.frameworks.total_frameworks} frameworks loaded`);
      console.log(`✅ ${data.rls_policies.total_tables} tables with RLS\n`);
      process.exit(0);
    } else {
      console.log('❌ OVERALL: UNHEALTHY\n');
      if (data.personas?.broken_personas > 0) {
        console.log(`❌ ${data.personas.broken_personas} broken personas`);
      }
      if (data.frameworks?.missing_count > 0) {
        console.log(`❌ Missing ${data.frameworks.missing_count} frameworks`);
      }
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    process.exit(2);
  }
}

runValidation();