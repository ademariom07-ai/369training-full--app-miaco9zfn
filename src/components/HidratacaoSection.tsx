import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Droplets,
  Bell,
  Volume2,
  CheckCircle2,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  Lock,
  Play,
  Pause,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

export function HidratacaoSection() {
  const { user } = useAuth()
  const isProOrPremium = user?.plan === 'pro' || user?.plan === 'premium'

  // Settings
  const [weight, setWeight] = useState<number>(75)
  const [goal, setGoal] = useState<'padrao' | 'hipertrofia' | 'resistencia'>('hipertrofia')
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60)
  const [soundOption, setSoundOption] = useState<'gota' | 'chime' | 'zen'>('gota')
  const [timerActive, setTimerActive] = useState<boolean>(false)
  const [notificationsGranted, setNotificationsGranted] = useState<boolean>(false)

  // Tracking
  const [waterDrunk, setWaterDrunk] = useState<number>(1200)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60 * 60)

  // Audio synthesize sound helper using Web Audio API (cross-browser, no external audio assets needed)
  const playAlertSound = (type: 'gota' | 'chime' | 'zen') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      osc.connect(gainNode)
      gainNode.connect(audioCtx.destination)

      const now = audioCtx.currentTime
      if (type === 'gota') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(600, now)
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15)
        gainNode.gain.setValueAtTime(0.4, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
        osc.start(now)
        osc.stop(now + 0.25)
      } else if (type === 'chime') {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(880, now)
        osc.frequency.setValueAtTime(1320, now + 0.1)
        gainNode.gain.setValueAtTime(0.3, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
        osc.start(now)
        osc.stop(now + 0.45)
      } else {
        // zen
        osc.type = 'sine'
        osc.frequency.setValueAtTime(432, now)
        gainNode.gain.setValueAtTime(0.3, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8)
        osc.start(now)
        osc.stop(now + 0.85)
      }
    } catch (_) {
      /* ignore audio autoplay restrictions */
    }
  }

  // Calculate daily recommended water based on ACSM:
  // Padrão: 35ml/kg | Hipertrofia: 40ml/kg | Resistência: 45ml/kg
  const getDailyTargetMl = () => {
    const multiplier = goal === 'resistencia' ? 45 : goal === 'hipertrofia' ? 40 : 35
    return Math.round(weight * multiplier)
  }

  const dailyTargetMl = getDailyTargetMl()
  const progressPct = Math.min(100, Math.round((waterDrunk / dailyTargetMl) * 100))

  // Request Notification Permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Este navegador não suporta notificações de sistema.')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setNotificationsGranted(true)
        toast.success('Permissão de notificações concedida!')
      } else {
        setNotificationsGranted(false)
        toast.warning('Notificações bloqueadas pelo navegador.')
      }
    } catch (_) {
      /* ignore */
    }
  }

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsGranted(true)
    }
  }, [])

  // Timer Tick
  useEffect(() => {
    if (!timerActive) return

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Trigger alert
          playAlertSound(soundOption)

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('💧 Hora de se Hidratar! (369TRAINING)', {
              body: `Beba um copo de água (250ml) para manter seu rendimento e atingir sua meta de ${dailyTargetMl}ml.`,
              icon: '/og-image.png',
            })
          }

          toast.info('💧 Hora de beber água! Mantenha o corpo hidratado.')
          return intervalMinutes * 60
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timerActive, intervalMinutes, soundOption, dailyTargetMl])

  // Handle Drink Water
  const handleAddWater = (ml: number) => {
    setWaterDrunk((prev) => Math.max(0, prev + ml))
    toast.success(`+${ml}ml registrados!`)
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#0057FF]/15 border border-[#0057FF]/40 rounded-xl text-[#0057FF]">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0057FF] uppercase tracking-wider font-montserrat">
                Diretriz ACSM • American College of Sports Medicine
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0057FF]/20 text-[#0057FF]">
                PRO/PREMIUM
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-montserrat text-white uppercase mt-0.5">
              Cronômetro & Alertas de Hidratação
            </h2>
          </div>
        </div>

        {/* Toggle Ativar/Desativar */}
        {isProOrPremium ? (
          <div className="flex items-center gap-3 bg-[#141414] px-4 py-2 rounded-xl border border-[#2A2A2A]">
            <span className="text-xs font-bold text-gray-300 font-montserrat uppercase">
              {timerActive ? 'Timer Ativo' : 'Timer Pausado'}
            </span>
            <Switch
              checked={timerActive}
              onCheckedChange={(c) => {
                if (c && !notificationsGranted) {
                  requestNotificationPermission()
                }
                setTimerActive(c)
                if (c) {
                  setSecondsRemaining(intervalMinutes * 60)
                  toast.success(`Cronômetro de hidratação ativado (a cada ${intervalMinutes} min)!`)
                }
              }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-montserrat font-bold">
            <Lock className="w-3.5 h-3.5" /> Exclusivo Pro/Premium
          </div>
        )}
      </div>

      {isProOrPremium ? (
        <div className="space-y-6">
          {/* Scientific Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Peso */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5 font-montserrat">
                Seu Peso Atual (kg)
              </label>
              <Input
                type="number"
                min="40"
                max="200"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="bg-[#141414] border-[#2A2A2A] text-white font-mono text-sm rounded-xl"
              />
            </div>

            {/* Objetivo ACSM */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5 font-montserrat">
                Objetivo & Fator ACSM
              </label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#0057FF] focus:outline-none"
              >
                <option value="padrao">Padrão / Saúde Geral (35ml/kg)</option>
                <option value="hipertrofia">Hipertrofia / Força (40ml/kg)</option>
                <option value="resistencia">Resistência / Aeróbico (45ml/kg)</option>
              </select>
            </div>

            {/* Intervalo */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5 font-montserrat">
                Intervalo entre Alertas
              </label>
              <select
                value={intervalMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setIntervalMinutes(val)
                  setSecondsRemaining(val * 60)
                }}
                className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#0057FF] focus:outline-none"
              >
                <option value={30}>A cada 30 minutos</option>
                <option value={45}>A cada 45 minutos</option>
                <option value={60}>A cada 60 minutos (1 hora)</option>
                <option value={90}>A cada 90 minutos (1h30)</option>
                <option value={120}>A cada 120 minutos (2 horas)</option>
              </select>
            </div>
          </div>

          {/* Sound & Notification Config Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#141414] border border-[#2A2A2A]">
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-[#0057FF]" />
              <span className="text-xs font-bold text-gray-300 uppercase font-montserrat">
                Tom de Alerta:
              </span>
              <div className="flex gap-2">
                {[
                  { id: 'gota', label: 'Gota D’água' },
                  { id: 'chime', label: 'Chime Esportivo' },
                  { id: 'zen', label: 'Sino Zen' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSoundOption(s.id as any)
                      playAlertSound(s.id as any)
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      soundOption === s.id
                        ? 'bg-[#0057FF] text-white'
                        : 'bg-[#181818] border border-[#2A2A2A] text-gray-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={requestNotificationPermission}
                className={`text-xs border-[#2A2A2A] ${
                  notificationsGranted ? 'text-[#22C55E]' : 'text-gray-300'
                }`}
              >
                <Bell className="w-3.5 h-3.5 mr-1" />
                {notificationsGranted ? 'Push Habilitado ✓' : 'Permitir Notificação Push'}
              </Button>
            </div>
          </div>

          {/* Realtime Countdown & Daily Gauge */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Countdown Box */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#141414] to-[#111111] border border-[#0057FF]/30 flex flex-col justify-between items-center text-center">
              <span className="text-xs font-bold text-gray-400 uppercase font-montserrat">
                Próximo Lembrete em
              </span>
              <div className="my-3 font-mono font-black text-4xl sm:text-5xl text-[#0057FF] tracking-wider">
                {timerActive ? formatTime(secondsRemaining) : '--:--'}
              </div>
              <p className="text-[11px] text-gray-400">
                {timerActive
                  ? 'Notificações ativas em segundo plano no navegador.'
                  : 'Ative o switch acima para iniciar os alertas sonoros.'}
              </p>
            </div>

            {/* Daily Consumption Progress */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#141414] to-[#111111] border border-[#2A2A2A] flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-gray-400 uppercase font-montserrat">
                    Consumo de Hoje
                  </span>
                  <span className="text-sm font-bold text-[#0057FF] font-mono">
                    {waterDrunk} / {dailyTargetMl} ml ({progressPct}%)
                  </span>
                </div>
                <div className="w-full h-3.5 bg-[#0E0E0E] rounded-full overflow-hidden border border-[#2A2A2A] p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0057FF] to-[#38BDF8] transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Quick Add Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#2A2A2A]">
                <Button
                  size="sm"
                  onClick={() => handleAddWater(250)}
                  className="flex-1 bg-[#0057FF] hover:bg-[#1f6aff] text-white text-xs font-bold"
                >
                  +250ml (Copo)
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAddWater(500)}
                  className="flex-1 bg-[#0057FF]/20 border border-[#0057FF]/40 text-[#0057FF] hover:bg-[#0057FF]/30 text-xs font-bold"
                >
                  +500ml (Garrafa)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setWaterDrunk(0)}
                  className="text-gray-500 hover:text-gray-300 text-xs px-2"
                  title="Zerar registro diário"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-xl bg-[#141414] border border-[#2A2A2A] text-center space-y-3">
          <Lock className="w-10 h-10 text-[#0057FF] mx-auto" />
          <h3 className="text-base font-bold font-montserrat text-white uppercase">
            Disponível nos Planos Pro e Premium
          </h3>
          <p className="text-xs text-gray-400 font-inter max-w-md mx-auto leading-relaxed">
            O cronômetro inteligente calcula sua taxa hídrica ideal segundo o ACSM e envia alertas
            push sonoros em segundo plano para otimizar sua hipertrofia e recuperação celular.
          </p>
        </div>
      )}
    </Card>
  )
}
