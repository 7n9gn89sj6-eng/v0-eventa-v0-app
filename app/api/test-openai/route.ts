import { NextResponse } from "next/server"
import OpenAI from "openai"

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY not configured",
          details: "The environment variable is not set",
        },
        { status: 503 }
      )
    }

    // Check if key format looks valid (starts with sk-)
    if (!apiKey.startsWith("sk-")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid API key format",
          details: "OpenAI API keys should start with 'sk-'",
          keyPrefix: apiKey.substring(0, 5) + "...",
        },
        { status: 400 }
      )
    }

    // Try to make a simple API call to verify the key works
    const client = new OpenAI({
      apiKey: apiKey,
    })

    // Make a minimal API call to check if key is valid
    // Using models.list() as it's a lightweight endpoint
    const models = await client.models.list()

    return NextResponse.json({
      success: true,
      message: "OpenAI API key is valid and working",
      details: {
        keyConfigured: true,
        keyFormat: "valid",
        apiAccessible: true,
        modelsAvailable: models.data.length > 0,
        sampleModels: models.data.slice(0, 3).map((m) => m.id),
      },
    })
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    const statusCode = error?.status || 500

    // Check for common error types
    let errorType = "unknown"
    if (errorMessage.includes("Invalid API key") || errorMessage.includes("Incorrect API key")) {
      errorType = "invalid_key"
    } else if (errorMessage.includes("Insufficient quota") || errorMessage.includes("billing")) {
      errorType = "quota_exceeded"
    } else if (errorMessage.includes("rate limit")) {
      errorType = "rate_limited"
    } else if (errorMessage.includes("expired")) {
      errorType = "expired"
    }

    return NextResponse.json(
      {
        success: false,
        error: "OpenAI API key verification failed",
        errorType,
        details: errorMessage,
        ...(error?.status && { httpStatus: error.status }),
      },
      { status: statusCode }
    )
  }
}








