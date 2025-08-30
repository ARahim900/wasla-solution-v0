import { GoogleGenAI } from "@google/genai"
import { type NextRequest, NextResponse } from "next/server"
import type { InspectionPhoto } from "../../../types"

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  console.error("GEMINI_API_KEY environment variable is not set.")
}

const ai = apiKey ? new GoogleGenAI(apiKey) : null

export async function POST(request: NextRequest) {
  if (!ai) {
    return NextResponse.json(
      { error: "API key not configured. Please set GEMINI_API_KEY in your environment variables." },
      { status: 500 },
    )
  }

  try {
    const { photo, pointDescription }: { photo: InspectionPhoto; pointDescription: string } = await request.json()

    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: photo.base64,
      },
    }

    const textPart = `Analyze this image which shows a potential defect related to "${pointDescription}". Describe the issue observed in the image in a concise, factual comment for an inspection report. Focus only on what is visually present. If no clear defect is visible, state that. Start your response directly with the description.`

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" })
    const response = await model.generateContent([textPart, imagePart])
    const analysis = response.response.text()

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error("Error analyzing defect image:", error)
    return NextResponse.json({ error: "Could not analyze image." }, { status: 500 })
  }
}
