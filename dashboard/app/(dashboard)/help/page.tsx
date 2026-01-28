"use client";

import { useEffect, useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from "lucide-react";
import { GlassPanel } from "@/app/components/ui/GlassPanel";
import { SectionHeader } from "@/app/components/ui/SectionHeader";

interface FAQItem {
  title: string;
  body: string;
}

interface FAQResponse {
  items: FAQItem[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL 
  ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1`
  : "http://localhost:8181/api/v1";

export default function HelpPage() {
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchFAQs();
  }, []);

  async function fetchFAQs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/help/faq`);
      if (!res.ok) {
        throw new Error(`Failed to fetch FAQs: ${res.statusText}`);
      }
      const data: FAQResponse = await res.json();
      setFaqItems(data.items || []);
    } catch (err) {
      console.error("Error fetching FAQs:", err);
      setError("Unable to load FAQ content. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  const toggleAccordion = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <SectionHeader
          title="Help & FAQ"
          subtitle="Frequently asked questions and support documentation"
          icon={HelpCircle}
        />

        <GlassPanel className="min-h-[50vh]">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-slate-500 animate-pulse">Loading help content...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col justify-center items-center h-64 gap-4 text-center">
              <div className="bg-red-100 p-4 rounded-full text-red-500">
                <AlertCircle size={32} />
              </div>
              <p className="text-slate-600 max-w-md">{error}</p>
              <button 
                onClick={fetchFAQs}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-lg shadow-blue-600/20"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            </div>
          ) : faqItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <HelpCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No FAQ items found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <div 
                  key={index} 
                  className={`glass rounded-2xl transition-all duration-300 hover:border-white/80 hover:shadow-md border border-white/40 overflow-hidden ${
                    expandedIndex === index ? 'bg-white/60' : 'bg-white/40 hover:bg-white/50'
                  }`}
                >
                  <button 
                    className="w-full p-6 flex justify-between items-center gap-4 text-left focus:outline-none"
                    onClick={() => toggleAccordion(index)}
                  >
                    <h3 className="text-lg font-semibold text-slate-800">{item.title}</h3>
                    <div className={`text-slate-500 transition-transform duration-300 ${expandedIndex === index ? 'rotate-180' : ''}`}>
                      <ChevronDown size={20} />
                    </div>
                  </button>
                  
                  <div 
                    className={`transition-all duration-300 ease-in-out ${
                      expandedIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-white/20 pt-4">
                      {item.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
