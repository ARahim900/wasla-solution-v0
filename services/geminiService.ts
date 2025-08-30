import type { InspectionItem, InspectionPhoto } from "../types"

export const generateReportSummary = async (failedItems: InspectionItem[]): Promise<string> => {
  try {
    const response = await fetch("/api/generate-summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ failedItems }),
    })

    const data = await response.json()

    if (!response.ok) {
      return `Error: ${data.error}`
    }

    return data.summary
  } catch (error) {
    console.error("Error generating report summary:", error)
    return "Error: Could not generate AI summary. Please check the console for details."
  }
}

export const analyzeDefectImage = async (photo: InspectionPhoto, pointDescription: string): Promise<string> => {
  try {
    const response = await fetch("/api/analyze-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ photo, pointDescription }),
    })

    const data = await response.json()

    if (!response.ok) {
      return `Error: ${data.error}`
    }

    return data.analysis
  } catch (error) {
    console.error("Error analyzing defect image:", error)
    return "Error: Could not analyze image."
  }
}
