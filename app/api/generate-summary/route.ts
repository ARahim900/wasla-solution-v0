import { GoogleGenAI } from "@google/genai"
import { type NextRequest, NextResponse } from "next/server"
import type { InspectionItem } from "../../../types"

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
    const { failedItems }: { failedItems: InspectionItem[] } = await request.json()

    const prompt = `
      You are an AI assistant for a property inspector. Your task is to generate a concise, professional, and easy-to-understand summary of findings for a property inspection report.
      Based on the following list of failed inspection points, create a summary.
      - Group related issues together (e.g., all plumbing issues, all electrical issues).
      - Start with the most critical issues.
      - Use clear headings and bullet points.
      - The tone should be objective and informative.

      Here are the failed items:
      ${failedItems.map((item) => `- ${item.category} - ${item.point}: ${item.comments || "No comment."} (Location: ${item.location || "General"})`).join("\n")}
    `

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" })
    const response = await model.generateContent(prompt)
    const summary = response.response.text()

    return NextResponse.json({ summary })
  } catch (error) {
    console.error("Error generating report summary:", error)
    return NextResponse.json(
      { error: "Could not generate AI summary. Please check the console for details." },
      { status: 500 },
    )
  }
}
