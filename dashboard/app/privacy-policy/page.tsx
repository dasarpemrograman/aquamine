"use client";

import Link from "next/link";
import { 
  ArrowLeft, 
  Shield, 
  Eye, 
  Lock, 
  Database, 
  UserCheck, 
  Mail, 
  FileText, 
  Share2, 
  Clock, 
  Server, 
  Baby, 
  RefreshCw 
} from "lucide-react";
import { useEffect, useState } from "react";

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState("intro");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3, rootMargin: "-100px 0px -50% 0px" }
    );

    const sections = document.querySelectorAll("section[id]");
    sections.forEach((section) => observer.observe(section));

    return () => sections.forEach((section) => observer.unobserve(section));
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 100,
        behavior: "smooth",
      });
      setActiveSection(id);
    }
  };

  const menuItems = [
    { id: "intro", label: "Introduction", icon: Shield },
    { id: "collection", label: "Data Collection", icon: Database },
    { id: "usage", label: "Data Usage", icon: Eye },
    { id: "security", label: "Security", icon: Lock },
    { id: "sharing", label: "Sharing", icon: Share2 },
    { id: "rights", label: "Your Rights", icon: UserCheck },
    { id: "retention", label: "Retention", icon: Clock },
    { id: "services", label: "Services", icon: Server },
    { id: "children", label: "Children", icon: Baby },
    { id: "changes", label: "Changes", icon: RefreshCw },
    { id: "contact", label: "Contact", icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-cyan-100 selection:text-cyan-900 font-sans">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-cyan-100/40 via-transparent to-transparent opacity-70" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-teal-100/40 via-transparent to-transparent opacity-70" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/50 shadow-sm transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link 
              href="/login"
              className="group inline-flex items-center gap-2 text-slate-600 hover:text-cyan-600 transition-colors px-3 py-1.5 rounded-full hover:bg-cyan-50"
            >
              <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
              <span className="font-medium text-sm">Back to Login</span>
            </Link>
            <div className="hidden md:flex items-center gap-2">
              <img 
                src="/aquamine-icon.png" 
                alt="AquaMine" 
                className="w-6 h-6 object-contain"
              />
              <span className="font-bold text-slate-800 tracking-tight">AquaMine</span>
            </div>
          </div>
        </header>

        <section className="pt-20 pb-16 md:pt-32 md:pb-24 px-4 sm:px-6 relative overflow-hidden">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight animate-fade-in-up">
              Privacy <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-teal-500">Policy</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-light">
              Your data security is our priority. Transparent, secure, and respectful of your privacy.
            </p>
            
            <div className="mt-8 inline-block px-4 py-2 bg-white/50 backdrop-blur-md rounded-full border border-slate-200 text-slate-500 text-sm font-medium">
              Last updated: February 5, 2026
            </div>
          </div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-200/20 rounded-full blur-3xl -z-10 animate-pulse" />
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="flex flex-col lg:flex-row gap-12">
            
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-28 space-y-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-3">Contents</h3>
                <nav className="space-y-1">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                        activeSection === item.id
                          ? "bg-cyan-50 text-cyan-700 shadow-sm ring-1 ring-cyan-200"
                          : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                      }`}
                    >
                      <item.icon size={16} className={activeSection === item.id ? "text-cyan-600" : "text-slate-400"} />
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="flex-1 space-y-8 max-w-4xl">
              
              <section id="intro" className="bg-white/70 backdrop-blur-md border border-white/60 rounded-3xl p-8 md:p-10 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-slate-100 text-slate-600">
                    <FileText size={24} />
                  </span>
                  Introduction
                </h2>
                <p className="text-slate-700 leading-relaxed text-lg">
                  AquaMine AI (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Acid Mine Drainage monitoring system.
                </p>
              </section>

              <section id="collection" className="bg-white/70 backdrop-blur-md border border-white/60 rounded-3xl p-8 md:p-10 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-cyan-100 rounded-2xl text-cyan-600 shrink-0">
                    <Database size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Information We Collect</h2>
                    <p className="text-slate-500 mt-1">We collect data to provide you with the best experience.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"/> Personal Information
                    </h3>
                    <p className="text-slate-600 mb-3 text-sm">We collect information you provide directly, including:</p>
                    <ul className="space-y-2 text-slate-700 text-sm">
                      {[
                        "Name and email address (via Clerk)",
                        "Profile information",
                        "Account preferences and settings",
                        "Communication history"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-cyan-500 mt-1">✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500"/> Sensor Data
                    </h3>
                    <p className="text-slate-600 mb-3 text-sm">Our system collects environmental monitoring data:</p>
                    <ul className="space-y-2 text-slate-700 text-sm">
                      {[
                        "Water quality parameters (pH, TDS, etc.)",
                        "Sensor location and status",
                        "Alert and incident records",
                        "Computer vision analysis",
                        "AI assistant conversations"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 md:col-span-2">
                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"/> Usage Information
                    </h3>
                    <p className="text-slate-600 mb-3 text-sm">We automatically collect:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Log data (IP, browser)",
                        "Device information",
                        "Interaction data"
                      ].map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section id="usage" className="bg-white/70 backdrop-blur-md border border-white/60 rounded-3xl p-8 md:p-10 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-teal-100 rounded-2xl text-teal-600 shrink-0">
                    <Eye size={28} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">How We Use Your Information</h2>
                </div>
                
                <ul className="grid sm:grid-cols-1 gap-3">
                  {[
                    "Provide and maintain the AquaMine monitoring service",
                    "Process and analyze environmental data",
                    "Send critical alerts and notifications about water quality",
                    "Improve our AI models and detection algorithms",
                    "Provide customer support",
                    "Ensure system security and prevent fraud",
                    "Comply with legal obligations"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/50 border border-slate-100 hover:border-teal-200 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section id="security" className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-8 md:p-10 shadow-xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all duration-500"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-white/10 rounded-2xl text-cyan-300 shrink-0 backdrop-blur-sm border border-white/10">
                      <Lock size={28} />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Data Security</h2>
                  </div>
                  
                  <p className="text-slate-300 leading-relaxed mb-6">
                    We implement industry-standard security measures to protect your information:
                  </p>
                  
                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    {[
                      "Encrypted data transmission (HTTPS/TLS)",
                      "Secure authentication via Clerk",
                      "Role-based access control",
                      "Regular security audits",
                      "Secure database storage with PostgreSQL"
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <Shield size={16} className="text-cyan-400" />
                        <span className="text-sm font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-slate-400 text-sm border-t border-white/10 pt-4">
                    However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
                  </p>
                </div>
              </section>

              <section id="sharing" className="bg-white/70 backdrop-blur-md border border-white/60 rounded-3xl p-8 md:p-10 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-purple-100 rounded-2xl text-purple-600 shrink-0">
                    <Share2 size={28} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Data Sharing</h2>
                </div>
                
                <p className="text-slate-700 leading-relaxed mb-6">
                  We do not sell your personal information. We may share data only in these circumstances:
                </p>
                
                <div className="space-y-4">
                  {[
                    { title: "Service Providers", desc: "Third-party vendors (e.g., Clerk for authentication, cloud hosting providers)" },
                    { title: "Legal Requirements", desc: "When required by law or to protect rights and safety" },
                    { title: "Business Transfers", desc: "In connection with a merger, acquisition, or asset sale" },
                    { title: "With Your Consent", desc: "When you explicitly authorize sharing" }
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-baseline gap-2 p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-slate-900 min-w-[160px]">{item.title}</strong>
                      <span className="text-slate-600">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section id="rights" className="bg-white/70 backdrop-blur-md border border-white/60 rounded-3xl p-8 md:p-10 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-green-100 rounded-2xl text-green-600 shrink-0">
                    <UserCheck size={28} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Your Rights</h2>
                </div>
                
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1">
                    <p className="text-slate-700 mb-4">You have the right to:</p>
                    <ul className="space-y-3">
                      {[
                        "Access your personal information",
                        "Correct inaccurate data",
                        "Request deletion of your data",
                        "Opt-out of non-essential notifications",
                        "Export your data"
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-slate-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="md:w-64 bg-green-50 rounded-2xl p-6 border border-green-100 flex flex-col justify-center text-center">
                    <p className="text-slate-700 text-sm mb-3">To exercise these rights, contact us at:</p>
                    <a 
                      href="mailto:arqilasp@gmail.com?subject=Privacy Rights Request" 
                      className="text-green-700 font-bold hover:underline break-all"
                    >
                      arqilasp@gmail.com
                    </a>
                  </div>
                </div>
              </section>

              <div className="grid md:grid-cols-2 gap-8">
                <section id="retention" className="bg-white/70 backdrop-blur-md border border-white/60 rounded-3xl p-8 shadow-lg shadow-slate-200/50">
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="text-orange-500" />
                    <h2 className="text-xl font-bold text-slate-900">Data Retention</h2>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    We retain your information for as long as necessary to provide our services and comply with legal obligations. Sensor data is retained for historical analysis and regulatory compliance. You may request deletion of your personal data at any time.
                  </p>
                </section>

                <section id="services" className="bg-white/70 backdrop-blur-md border border-white/60 rounded-3xl p-8 shadow-lg shadow-slate-200/50">
                  <div className="flex items-center gap-3 mb-4">
                    <Server className="text-blue-500" />
                    <h2 className="text-xl font-bold text-slate-900">Third-Party Services</h2>
                  </div>
                  <ul className="space-y-2 mb-3">
                    <li className="text-sm text-slate-700"><strong>Clerk:</strong> Authentication</li>
                    <li className="text-sm text-slate-700"><strong>TimeGPT:</strong> Forecasting</li>
                    <li className="text-sm text-slate-700"><strong>OpenAI:</strong> Chat assistance</li>
                  </ul>
                  <p className="text-xs text-slate-500">
                    These services have their own privacy policies. We encourage you to review them.
                  </p>
                </section>

                <section id="children" className="bg-white/70 backdrop-blur-md border border-white/60 rounded-3xl p-8 shadow-lg shadow-slate-200/50">
                  <div className="flex items-center gap-3 mb-4">
                    <Baby className="text-pink-500" />
                    <h2 className="text-xl font-bold text-slate-900">Children&apos;s Privacy</h2>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    AquaMine is not intended for users under 18 years of age. We do not knowingly collect information from children.
                  </p>
                </section>

                <section id="changes" className="bg-white/70 backdrop-blur-md border border-white/60 rounded-3xl p-8 shadow-lg shadow-slate-200/50">
                  <div className="flex items-center gap-3 mb-4">
                    <RefreshCw className="text-slate-500" />
                    <h2 className="text-xl font-bold text-slate-900">Policy Changes</h2>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    We may update this Privacy Policy periodically. Changes will be posted on this page with an updated &quot;Last updated&quot; date. Continued use of AquaMine after changes constitutes acceptance.
                  </p>
                </section>
              </div>

              <section id="contact" className="bg-gradient-to-r from-cyan-50 to-teal-50 rounded-3xl p-8 md:p-10 border border-cyan-100 text-center">
                <div className="inline-flex p-4 bg-white rounded-full shadow-sm mb-6">
                  <Mail className="w-8 h-8 text-cyan-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Contact Us</h2>
                <p className="text-slate-600 mb-8 max-w-md mx-auto">
                  If you have questions or concerns about this Privacy Policy, please contact us. We are here to help.
                </p>
                
                <a 
                  href="mailto:arqilasp@gmail.com?subject=Privacy Policy Inquiry" 
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-1"
                >
                  <Mail size={20} />
                  arqilasp@gmail.com
                </a>
              </section>

            </div>
          </div>
        </div>

        <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center border-t border-slate-200">
          <p className="text-slate-500">© 2026 AquaMine AI. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
