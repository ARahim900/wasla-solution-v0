"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import type {
  InspectionData,
  InspectionArea,
  InspectionItem,
  InspectionPhoto,
  InspectionStatus,
  Client,
  Invoice,
} from "./types"
import { INSPECTION_CATEGORIES, MOCK_CLIENTS } from "./constants"
import { analyzeDefectImage } from "./services/geminiService"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

// --- Local Storage Hooks ---
const useInspections = () => {
  const getInspections = (): InspectionData[] => {
    try {
      const inspections = JSON.parse(localStorage.getItem("inspections") || "[]") as InspectionData[]
      return inspections.sort((a, b) => new Date(b.inspectionDate).getTime() - new Date(a.inspectionDate).getTime())
    } catch (error) {
      console.error("Error parsing inspections from localStorage", error)
      return []
    }
  }

  const getInspectionById = (id: string): InspectionData | null => {
    const inspections = getInspections()
    return inspections.find((insp) => insp.id === id) || null
  }

  const saveInspection = (inspectionData: InspectionData): void => {
    const inspections = getInspections().filter((insp) => insp.id !== inspectionData.id)
    inspections.push(inspectionData)
    localStorage.setItem("inspections", JSON.stringify(inspections))
  }

  const deleteInspection = (id: string): void => {
    const inspections = getInspections().filter((insp) => insp.id !== id)
    localStorage.setItem("inspections", JSON.stringify(inspections))
  }

  return { getInspections, getInspectionById, saveInspection, deleteInspection }
}

const useClients = () => {
  const getClients = (): Client[] => {
    try {
      const clients = localStorage.getItem("clients")
      if (clients) {
        return JSON.parse(clients) as Client[]
      }
      // If no clients, load mock data and save it
      localStorage.setItem("clients", JSON.stringify(MOCK_CLIENTS))
      return MOCK_CLIENTS
    } catch (error) {
      console.error("Error parsing clients from localStorage", error)
      return []
    }
  }

  const saveClient = (clientData: Client): void => {
    const clients = getClients().filter((c) => c.id !== clientData.id)
    clients.push(clientData)
    localStorage.setItem("clients", JSON.stringify(clients))
  }

  const deleteClient = (id: string): void => {
    const clients = getClients().filter((c) => c.id !== id)
    localStorage.setItem("clients", JSON.stringify(clients))
  }

  return { getClients, saveClient, deleteClient }
}

const useInvoices = () => {
  const getInvoices = (): Invoice[] => {
    try {
      const invoices = JSON.parse(localStorage.getItem("invoices") || "[]") as Invoice[]
      return invoices.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
    } catch (error) {
      console.error("Error parsing invoices from localStorage", error)
      return []
    }
  }

  const getInvoiceById = (id: string): Invoice | null => {
    return getInvoices().find((inv) => inv.id === id) || null
  }

  const saveInvoice = (invoiceData: Invoice): void => {
    const invoices = getInvoices().filter((inv) => inv.id !== invoiceData.id)
    invoices.push(invoiceData)
    localStorage.setItem("invoices", JSON.stringify(invoices))
  }

  const deleteInvoice = (id: string): void => {
    const invoices = getInvoices().filter((inv) => inv.id !== id)
    localStorage.setItem("invoices", JSON.stringify(invoices))
  }

  return { getInvoices, getInvoiceById, saveInvoice, deleteInvoice }
}

// --- Helper Functions ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve((reader.result as string).split(",")[1])
    reader.onerror = (error) => reject(error)
  })
}

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A"
  // Handles 'YYYY-MM-DD' format from date inputs
  const date = new Date(dateString)
  const timeZoneOffset = date.getTimezoneOffset() * 60000
  const adjustedDate = new Date(date.getTime() + timeZoneOffset)

  return adjustedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const formatCurrency = (amount: number, currency = "OMR") => {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  // The previous implementation had inconsistent formatting.
  // This ensures that the currency symbol/code is always prepended,
  // matching the convention seen in the screenshot (e.g., "$0.00").
  // It also handles the case where an empty string is passed from dashboard cards.
  const displayCurrency = currency || "OMR"

  return `${displayCurrency} ${formattedAmount}`
}

// --- UI Components ---
const Spinner: React.FC<{ className?: string }> = ({ className = "text-white" }) => (
  <svg
    className={`spinner-smooth h-5 w-5 ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
  </svg>
)

const Modal: React.FC<{
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl" | "2xl"
}> = ({ isOpen, onClose, title, children, size = "2xl" }) => {
  if (!isOpen) return null
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }
  return (
    <div
      className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex justify-center items-center fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-card dark:bg-card rounded-xl shadow-2xl p-6 w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto slide-in-up border border-border`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-border pb-4 mb-6">
          <h3 className="text-xl font-semibold text-card-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl p-1 rounded-lg hover:bg-muted transition-all duration-200"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const PhotoUpload: React.FC<{
  photos: InspectionPhoto[]
  onUpload: (photo: InspectionPhoto) => void
  onRemove: (index: number) => void
}> = ({ photos, onUpload, onRemove }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      for (const file of Array.from(event.target.files)) {
        try {
          const base64 = await fileToBase64(file)
          onUpload({ base64, name: file.name })
        } catch (error) {
          console.error("Error converting file to base64", error)
        }
      }
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-3">
        {photos.map((photo, index) => (
          <div key={index} className="relative group card-hover">
            <img
              src={`data:image/jpeg;base64,${photo.base64}`}
              alt={`upload-preview-${index}`}
              className="w-full h-20 object-cover rounded-lg border border-border"
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:scale-110"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-300 group"
        >
          <svg
            className="w-6 h-6 group-hover:scale-110 transition-transform duration-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4"></path>
          </svg>
          <span className="text-xs mt-1 font-medium">Add Photo</span>
        </button>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept="image/*" />
    </div>
  )
}

const InspectionItemRow: React.FC<{
  item: InspectionItem
  onUpdate: (updatedItem: InspectionItem) => void
  onRemove: () => void
}> = ({ item, onUpdate, onRemove }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleUpdate = (field: keyof InspectionItem, value: any) => {
    onUpdate({ ...item, [field]: value })
  }

  const handleAnalyze = async (photo: InspectionPhoto) => {
    setIsAnalyzing(true)
    try {
      const analysis = await analyzeDefectImage(photo, item.point)
      handleUpdate("comments", `${item.comments ? item.comments + "\n\n" : ""}AI Analysis: ${analysis}`)
    } catch (error) {
      console.error("AI Analysis failed:", error)
      handleUpdate("comments", `${item.comments ? item.comments + "\n\n" : ""}AI Analysis failed.`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const statusClasses: { [key in InspectionStatus]: string } = {
    Pass: "status-badge status-success",
    Fail: "status-badge status-error",
    "N/A": "status-badge bg-muted text-muted-foreground",
  }

  return (
    <div className="bg-card p-6 rounded-xl border border-border space-y-4 card-hover">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-card-foreground text-lg">{item.point}</p>
          <p className="text-sm text-muted-foreground mt-1">{item.category}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive text-xl font-bold p-2 rounded-lg hover:bg-destructive/10 transition-all duration-200"
        >
          &times;
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-card-foreground mb-2">Status</label>
          <select
            value={item.status}
            onChange={(e) => handleUpdate("status", e.target.value)}
            className={`w-full p-3 rounded-lg border-2 font-medium ${statusClasses[item.status]} bg-input`}
          >
            <option value="Pass">Pass</option>
            <option value="Fail">Fail</option>
            <option value="N/A">N/A</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-card-foreground mb-2">Location</label>
          <input
            type="text"
            value={item.location}
            onChange={(e) => handleUpdate("location", e.target.value)}
            placeholder="e.g., Master Bedroom Ceiling"
            className="w-full p-3 border border-border bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-card-foreground mb-2">Comments</label>
        <textarea
          value={item.comments}
          onChange={(e) => handleUpdate("comments", e.target.value)}
          placeholder="Add comments..."
          rows={3}
          className="w-full p-3 border border-border bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 resize-none"
        ></textarea>
      </div>

      <div>
        <label className="block text-sm font-medium text-card-foreground mb-2">Photos</label>
        <PhotoUpload
          photos={item.photos}
          onUpload={(photo) => handleUpdate("photos", [...item.photos, photo])}
          onRemove={(index) =>
            handleUpdate(
              "photos",
              item.photos.filter((_, i) => i !== index),
            )
          }
        />
        {item.status === "Fail" && item.photos.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => handleAnalyze(item.photos[item.photos.length - 1])}
              disabled={isAnalyzing}
              className={`btn-primary text-sm px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                isAnalyzing ? "btn-loading" : ""
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Spinner className="text-primary-foreground" /> Analyzing...
                </>
              ) : (
                "AI Analyze Last Photo"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const InspectionAreaCard: React.FC<{
  area: InspectionArea
  onUpdate: (updatedArea: InspectionArea) => void
  onRemove: () => void
}> = ({ area, onUpdate, onRemove }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleNameChange = (newName: string) => {
    onUpdate({ ...area, name: newName })
  }

  const handleAddItem = (category: string, point: string) => {
    const newItem: InspectionItem = {
      id: Date.now(),
      category,
      point,
      status: "N/A",
      comments: "",
      location: "",
      photos: [],
    }
    onUpdate({ ...area, items: [...area.items, newItem] })
  }

  const handleUpdateItem = (updatedItem: InspectionItem) => {
    const newItems = area.items.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    onUpdate({ ...area, items: newItems })
  }

  const handleRemoveItem = (itemId: number) => {
    const newItems = area.items.filter((item) => item.id !== itemId)
    onUpdate({ ...area, items: newItems })
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 shadow-sm mb-6 border dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <input
          type="text"
          value={area.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="text-xl font-bold bg-transparent border-b-2 border-transparent focus:border-blue-500 outline-none text-gray-900 dark:text-gray-100"
          placeholder="Area Name"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold"
        >
          Remove Area
        </button>
      </div>

      <div className="space-y-4">
        {area.items.map((item) => (
          <InspectionItemRow
            key={item.id}
            item={item}
            onUpdate={handleUpdateItem}
            onRemove={() => handleRemoveItem(item.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md w-full"
      >
        Add Inspection Point
      </button>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Inspection Point">
        <div className="space-y-4">
          {Object.entries(INSPECTION_CATEGORIES).map(([category, points]) => (
            <div key={category}>
              <h4 className="font-semibold text-lg text-gray-700 dark:text-gray-300 mb-2 border-b dark:border-gray-600 pb-1">
                {category}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {points.map((point) => (
                  <button
                    type="button"
                    key={point}
                    onClick={() => {
                      handleAddItem(category, point)
                      setIsModalOpen(false)
                    }}
                    className="text-left p-2 bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md text-sm transition text-gray-800 dark:text-gray-300"
                  >
                    {point}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

const InspectionForm: React.FC<{ inspectionId?: string; onSave: () => void; onCancel: () => void }> = ({
  inspectionId,
  onSave,
  onCancel,
}) => {
  const { getInspectionById, saveInspection } = useInspections()
  const [inspection, setInspection] = useState<InspectionData | null>(null)

  useEffect(() => {
    if (inspectionId) {
      setInspection(getInspectionById(inspectionId))
    } else {
      setInspection({
        id: `insp_${Date.now()}`,
        clientName: "",
        propertyLocation: "",
        propertyType: "Apartment",
        inspectorName: "",
        inspectionDate: new Date().toISOString().split("T")[0],
        areas: [{ id: Date.now(), name: "General", items: [] }],
      })
    }
  }, [inspectionId])

  const handleUpdateField = (field: keyof InspectionData, value: any) => {
    if (inspection) {
      setInspection({ ...inspection, [field]: value })
    }
  }

  const handleAddArea = () => {
    if (inspection) {
      const newArea: InspectionArea = { id: Date.now(), name: `New Area ${inspection.areas.length + 1}`, items: [] }
      handleUpdateField("areas", [...inspection.areas, newArea])
    }
  }

  const handleUpdateArea = (updatedArea: InspectionArea) => {
    if (inspection) {
      const newAreas = inspection.areas.map((area) => (area.id === updatedArea.id ? updatedArea : area))
      handleUpdateField("areas", newAreas)
    }
  }

  const handleRemoveArea = (areaId: number) => {
    if (inspection) {
      const newAreas = inspection.areas.filter((area) => area.id !== areaId)
      handleUpdateField("areas", newAreas)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inspection) {
      saveInspection(inspection)
      onSave()
    }
  }

  if (!inspection)
    return (
      <div className="text-center p-8">
        <Spinner className="text-blue-600 dark:text-blue-400 mx-auto" />
      </div>
    )

  const inputClasses =
    "p-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-200"

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Inspection Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Client Name"
            value={inspection.clientName}
            onChange={(e) => handleUpdateField("clientName", e.target.value)}
            required
            className={inputClasses}
          />
          <input
            type="text"
            placeholder="Property Location"
            value={inspection.propertyLocation}
            onChange={(e) => handleUpdateField("propertyLocation", e.target.value)}
            required
            className={inputClasses}
          />
          <input
            type="text"
            placeholder="Inspector Name"
            value={inspection.inspectorName}
            onChange={(e) => handleUpdateField("inspectorName", e.target.value)}
            required
            className={inputClasses}
          />
          <input
            type="date"
            value={inspection.inspectionDate}
            onChange={(e) => handleUpdateField("inspectionDate", e.target.value)}
            required
            className={inputClasses}
          />
          <div>
            <select
              value={inspection.propertyType}
              onChange={(e) => handleUpdateField("propertyType", e.target.value)}
              required
              className={`${inputClasses} w-full`}
            >
              <option value="Apartment">Apartment</option>
              <option value="Villa">Villa</option>
              <option value="Building">Building</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        {inspection.areas.map((area) => (
          <InspectionAreaCard
            key={area.id}
            area={area}
            onUpdate={handleUpdateArea}
            onRemove={() => handleRemoveArea(area.id)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleAddArea}
          className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded-md"
        >
          Add Another Area
        </button>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md"
          >
            Cancel
          </button>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">
            Save Inspection
          </button>
        </div>
      </div>
    </form>
  )
}

const ReportTemplate: React.FC<{ inspection: InspectionData }> = ({ inspection }) => {
  const WaslaLogo = () => (
    <div className="flex items-center space-x-2">
      <div className="flex flex-col">
        <div className="w-4 h-4 bg-green-500"></div>
        <div className="w-4 h-2 bg-blue-500 mt-0.5"></div>
      </div>
      <div className="text-2xl font-bold tracking-wider text-gray-700 dark:text-gray-300">
        <span className="text-green-500">WASLA</span>
        <p className="text-xs font-normal tracking-normal text-gray-500 dark:text-gray-400">Property Solutions</p>
      </div>
    </div>
  )

  return (
    <div className="print:block hidden">
      {/* Page 1 */}
      <div className="printable-a4 bg-white dark:bg-gray-800 p-8 text-sm break-after-page">
        <header className="flex justify-center items-center flex-col mb-4">
          <WaslaLogo />
          <h1 className="text-xl font-bold mt-2 text-gray-800 dark:text-gray-100 uppercase tracking-widest">
            Property Inspection Report
          </h1>
        </header>

        <div className="flex space-x-8">
          {/* English Column */}
          <div className="w-1/2 space-y-4">
            <section>
              <h2 className="font-bold border-b pb-1 mb-2 text-base">OVERVIEW</h2>
              <p className="font-bold">Dear Mr. {inspection.clientName},</p>
              <p>
                Thank you for choosing Wasla Real Estate Solutions as your home inspector. Your prospective home is
                basically in grade () as per our inspection and classifications. However, a number of rather typical
                inspection issues were identified.
              </p>
              <p>
                Please review the annexed report carefully before making your decision. If you need further explanation
                regarding this property conditions, please don't hesitate to call or email us from 9:00 am to 5:00 PM
                at:
              </p>
              <p>Email: wasla.solution@gmail.com</p>
              <p>Mobile: +968 90699799</p>
            </section>

            <section className="border-t pt-2">
              <h3 className="font-bold">No property is perfect.</h3>
              <p>
                Every building has imperfections or items that are ready for maintenance. It's the inspector's task to
                discover and report these so you can make informed decisions. This report should not be used as a tool
                to demean property, but rather as a way to illuminate the realities of the property.
              </p>
            </section>

            <section className="border-t pt-2">
              <h3 className="font-bold">This report is not an appraisal.</h3>
              <p>
                When an appraiser determines worth, only the most obvious conditions of a property are taken into
                account to establish a safe loan amount. In effect, the appraiser is representing the interests of the
                lender. Home inspectors focus more on the interests of the prospective buyer; and, although inspectors
                must be careful not to make any statements relating to property value, their findings can help buyers
                more completely understand the true costs of ownership.
              </p>
            </section>

            <section className="border-t pt-2">
              <h3 className="font-bold">Maintenance costs are normal.</h3>
              <p>
                Homeowners should plan to spend around 1% of the total value of a property in maintenance costs,
                annually. (Annual costs of rental property maintenance are often 2%, or more.) If considerably less than
                this percentage has been invested during several years preceding an inspection, the property will
                usually show the obvious signs of neglect; and the new property owners may be required to invest
                significant time and money to address accumulated maintenance needs.
              </p>
            </section>

            <section className="border-t pt-2">
              <h3 className="font-bold">SCOPE OF THE INSPECTION:</h3>
              <p>This report details the outcome of a visual survey of the property detailed in the annexed</p>
            </section>
          </div>

          {/* Arabic Column */}
          <div className="w-1/2 space-y-4 text-right" dir="rtl">
            <section>
              <h2 className="font-bold border-b pb-1 mb-2 text-base">نظرة عامة</h2>
              <p className="font-bold">الأفاضل/ المحترمون {inspection.clientName}،</p>
              <p>
                نشكر لكم اختياركم "وصلة للحلول العقارية" للقيام بفحص العقار الخاص بكم. وفقًا للفحص والتصنيف المعتمد
                لدينا، فإن العقار الذي ترغبون في في شرائه يقع ضمن الدرجة ()، مع وجود بعض الملاحظات التي تُعد شائعة في
                عمليات الفحص العقاري.
              </p>
              <p>
                يرجى مراجعة التقرير المرفق بعناية قبل اتخاذ قراركم النهائ، و إذا كنتم بحاجة إلى توضيحات إضافية حول حالة
                العقار، فلا تترددوا بالتواصل معنا عبر الهاتف أو البريد الإلكتروني من الساعة 9 صباحًا حتى 5 مساءً على وسائل
                التواصل التالية:
              </p>
              <p>البريد الإلكتروني: wasla.solution@gmail.com</p>
              <p>لهاتف: +96890699799</p>
            </section>

            <section className="border-t pt-2">
              <h3 className="font-bold">لا يوجد عقار مثالي</h3>
              <p>
                كل عقار يحتوي على بعض العيوب أو الأجزاء التي تحتاج إلى صيانة. دور المفتش هو تحديد هذه النقاط وتقديمها
                بوضوح لمساعدتكم في اتخاذ قرارات مستنيرة. هذا التقرير لا يُقصد به التقليل من قيمة العقار، وإنما يهدف إلى
                توضيح الحالة الواقعية له.
              </p>
            </section>

            <section className="border-t pt-2">
              <h3 className="font-bold">هذا التقرير ليس تقييما سعريًا</h3>
              <p>
                عند قيام المثمن بتحديد قيمة العقار، فإنه يأخذ بعين الاعتبار فقط العيوب الظاهرة لتقدير مبلغ قرض آمن.
                بمعنى آخر، فإن المثمن يُمثل مصلحة الجهة المقرضة. أما فاحص العقار، فيركز على مصلحة المشتري المحتمل. ورغم
                أن المفتش لا يحدد قيمة العقار، إلا أن نتائج الفحص تساعد المشتري في فهم التكاليف الحقيقية لامتلاك العقار.
              </p>
            </section>

            <section className="border-t pt-2">
              <h3 className="font-bold">تكاليف الصيانة أمر طبيعي</h3>
              <p>
                ينبغي على مالكي العقارات تخصيص ما يُعادل 1% من قيمة العقار سنويًا لأعمال الصيانة الدورية. أما العقارات\
                المؤجرة فقد تصل النسبة إلى 2% أو أكثر. وإذا لم يتم استثمار هذه النسبة على
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Main App Component ---
const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>("dashboard")
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { getInspections, deleteInspection } = useInspections()
  const { getClients, deleteClient } = useClients()
  const { getInvoices, deleteInvoice } = useInvoices()

  const inspections = getInspections()
  const clients = getClients()
  const invoices = getInvoices()

  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "inspections", label: "Inspections", icon: "🏠" },
    { id: "clients", label: "Clients", icon: "👥" },
    { id: "invoices", label: "Invoices", icon: "💰" },
    { id: "reports", label: "Reports", icon: "📋" },
  ]

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <div className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-card p-6 rounded-xl border border-border card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Inspections</p>
                    <p className="text-2xl font-bold text-card-foreground">{inspections.length}</p>
                  </div>
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🏠</span>
                  </div>
                </div>
              </div>

              <div className="bg-card p-6 rounded-xl border border-border card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                    <p className="text-2xl font-bold text-card-foreground">{clients.length}</p>
                  </div>
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                </div>
              </div>

              <div className="bg-card p-6 rounded-xl border border-border card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
                    <p className="text-2xl font-bold text-card-foreground">{invoices.length}</p>
                  </div>
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">💰</span>
                  </div>
                </div>
              </div>

              <div className="bg-card p-6 rounded-xl border border-border card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold text-card-foreground">
                      {formatCurrency(invoices.reduce((sum, inv) => sum + inv.totalAmount, 0))}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📈</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card p-6 rounded-xl border border-border">
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Recent Inspections</h3>
                <div className="space-y-3">
                  {inspections.slice(0, 5).map((inspection, index) => (
                    <div
                      key={inspection.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg stagger-animation"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div>
                        <p className="font-medium text-card-foreground">{inspection.clientName}</p>
                        <p className="text-sm text-muted-foreground">{inspection.propertyLocation}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{formatDate(inspection.inspectionDate)}</p>
                        <p className="text-xs text-muted-foreground">{inspection.propertyType}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card p-6 rounded-xl border border-border">
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Recent Invoices</h3>
                <div className="space-y-3">
                  {invoices.slice(0, 5).map((invoice, index) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg stagger-animation"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div>
                        <p className="font-medium text-card-foreground">{invoice.clientName}</p>
                        <p className="text-sm text-muted-foreground">Invoice #{invoice.invoiceNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-card-foreground">{formatCurrency(invoice.totalAmount)}</p>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            invoice.status === "Paid"
                              ? "status-success"
                              : invoice.status === "Pending"
                                ? "status-warning"
                                : "status-error"
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )

      case "inspections":
        if (selectedInspectionId === "new") {
          return (
            <InspectionForm
              onSave={() => {
                setSelectedInspectionId(null)
                setCurrentView("inspections")
              }}
              onCancel={() => setSelectedInspectionId(null)}
            />
          )
        }

        if (selectedInspectionId) {
          return (
            <InspectionForm
              inspectionId={selectedInspectionId}
              onSave={() => {
                setSelectedInspectionId(null)
                setCurrentView("inspections")
              }}
              onCancel={() => setSelectedInspectionId(null)}
            />
          )
        }

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Inspections</h1>
              <button
                onClick={() => setSelectedInspectionId("new")}
                className="btn-primary px-6 py-3 rounded-lg font-medium"
              >
                New Inspection
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inspections.map((inspection, index) => (
                <div
                  key={inspection.id}
                  className="bg-card p-6 rounded-xl border border-border card-hover stagger-animation"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-card-foreground text-lg">{inspection.clientName}</h3>
                      <p className="text-muted-foreground text-sm">{inspection.propertyLocation}</p>
                    </div>
                    <span className="status-badge bg-primary/10 text-primary">{inspection.propertyType}</span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Inspector:</span>
                      <span className="text-card-foreground">{inspection.inspectorName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="text-card-foreground">{formatDate(inspection.inspectionDate)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Areas:</span>
                      <span className="text-card-foreground">{inspection.areas.length}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedInspectionId(inspection.id)}
                      className="flex-1 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this inspection?")) {
                          deleteInspection(inspection.id)
                        }
                      }}
                      className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Coming Soon</h2>
            <p className="text-muted-foreground">This section is under development.</p>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">W</span>
            </div>
            <div>
              <h2 className="font-bold text-card-foreground">WASLA</h2>
              <p className="text-xs text-muted-foreground">Property Solutions</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id)
                setSelectedInspectionId(null)
                setSelectedClientId(null)
                setSelectedInvoiceId(null)
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                currentView === item.id
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors duration-200"
            >
              <svg className="h-6 w-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium">A</span>
              </div>
              <span className="text-foreground font-medium">Admin</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{renderContent()}</main>
      </div>
    </div>
  )
}

// --- Default Export ---
export default App
