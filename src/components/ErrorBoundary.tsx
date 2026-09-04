import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CrestLogo } from '@/components/CrestLogo'
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[369TRAINING ErrorBoundary] Capturado erro na aplicação:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }))
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const errorMessage =
        this.state.error?.message || 'Ocorreu um erro inesperado ao carregar esta tela.'
      const componentStack = this.state.errorInfo?.componentStack

      return (
        <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-4 selection:bg-[#D4AF37] selection:text-black">
          {/* Subtle brand glow in the background */}
          <div className="fixed inset-0 pointer-events-none opacity-20">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#0057FF]/30 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#D4AF37]/20 rounded-full blur-3xl" />
          </div>

          <Card className="relative z-10 max-w-xl w-full bg-[#141414] border-2 border-[#D4AF37]/50 shadow-[0_0_50px_rgba(212,175,55,0.15)] p-6 sm:p-8 rounded-2xl">
            {/* Header / Brand */}
            <div className="flex flex-col items-center text-center space-y-4">
              <CrestLogo size={52} showText subText />

              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#0057FF]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shadow-lg">
                <AlertTriangle className="w-7 h-7 text-[#D4AF37]" />
              </div>

              <div>
                <span className="text-[11px] font-bold tracking-widest text-[#D4AF37] uppercase font-montserrat">
                  369 TRAINING • RECUPERAÇÃO DE SISTEMA
                </span>
                <h1 className="text-xl sm:text-2xl font-black font-montserrat text-white mt-1">
                  Ops! Algo inesperado aconteceu nesta tela
                </h1>
                <p className="text-xs sm:text-sm text-gray-300 font-inter mt-2 max-w-md mx-auto">
                  A aplicação protegeu seus dados com segurança. Você pode tentar recarregar a tela
                  ou retornar ao início da plataforma.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="mt-6 p-3.5 rounded-xl bg-[#0E0E0E] border border-[#2A2A2A] text-left">
              <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                <span className="text-[10px] uppercase font-bold text-[#0057FF] font-montserrat">
                  Diagnóstico Técnico
                </span>
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 font-inter transition-colors"
                >
                  {this.state.showDetails ? (
                    <>
                      Ocultar detalhes <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      Ver detalhes <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs font-mono text-amber-300 mt-1.5 break-words">{errorMessage}</p>

              {this.state.showDetails && componentStack && (
                <pre className="mt-3 p-2.5 rounded bg-black/60 border border-white/5 text-[10px] font-mono text-gray-400 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {componentStack}
                </pre>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                onClick={this.handleReload}
                className="flex-1 bg-[#D4AF37] hover:bg-[#E6C65C] text-black font-extrabold text-xs uppercase py-5 rounded-xl shadow-lg flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Recarregar Tela
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={this.handleGoHome}
                className="flex-1 border-[#0057FF] text-[#0057FF] hover:bg-[#0057FF]/10 font-bold text-xs uppercase py-5 rounded-xl flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" /> Ir para o Início
              </Button>
            </div>

            {/* Subtle subtext */}
            <p className="text-center text-[10px] text-gray-500 font-inter mt-5">
              369TRAINING • Legado, Foco & Estratégia • Modelo Híbrido Protegido
            </p>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
