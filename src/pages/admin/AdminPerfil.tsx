import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ShieldCheck,
  User,
  Mail,
  Phone,
  Layers,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Share2,
  Copy,
  Calendar,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminPerfil() {
  const { user, refreshUser } = useAuth()

  // Form de alteração de senha
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showOldPass, setShowOldPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Form de dados editáveis da conta (nome, telefone)
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [savingAccount, setSavingAccount] = useState(false)

  // Manter estado sincronizado se o user carregar depois
  React.useEffect(() => {
    if (user) {
      if (user.name) setName(user.name)
      if (user.phone) setPhone(user.phone)
    }
  }, [user])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado com sucesso!`)
  }

  // Atualizar dados cadastrais
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!name.trim()) {
      toast.error('O nome completo é obrigatório.')
      return
    }

    setSavingAccount(true)
    try {
      await pb.collection('users').update(user.id, {
        name: name.trim(),
        phone: phone.trim(),
      })
      await refreshUser()
      toast.success('Dados cadastrais atualizados com sucesso!')
    } catch (err: any) {
      console.error('Erro ao atualizar dados cadastrais:', err)
      const msg =
        err?.data?.message ||
        err?.message ||
        'Não foi possível atualizar os dados. Tente novamente.'
      toast.error(msg)
    } finally {
      setSavingAccount(false)
    }
  }

  // Alteração de senha no PocketBase
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!oldPassword) {
      toast.error('Informe sua senha atual.')
      return
    }

    if (!newPassword) {
      toast.error('Informe a nova senha.')
      return
    }

    if (newPassword.length < 8) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (newPassword !== passwordConfirm) {
      toast.error('A confirmação da nova senha não confere.')
      return
    }

    if (oldPassword === newPassword) {
      toast.error('A nova senha não pode ser idêntica à senha atual.')
      return
    }

    setChangingPassword(true)
    try {
      // PocketBase padrão para alteração de senha:
      // update(id, { oldPassword, password, passwordConfirm })
      await pb.collection('users').update(user.id, {
        oldPassword,
        password: newPassword,
        passwordConfirm,
      })

      toast.success('Senha alterada com sucesso!')
      setOldPassword('')
      setNewPassword('')
      setPasswordConfirm('')
    } catch (err: any) {
      console.error('Erro ao alterar senha:', err)

      // Análise amigável dos erros do PocketBase
      const responseData = err?.response?.data || err?.data?.data || {}
      let userMsg = 'Erro ao alterar senha. Verifique os dados e tente novamente.'

      if (
        responseData?.oldPassword?.message ||
        err?.message?.toLowerCase().includes('old password') ||
        err?.message?.toLowerCase().includes('senha atual')
      ) {
        userMsg = 'Senha atual incorreta. Por favor, confira sua senha.'
      } else if (responseData?.password?.message) {
        userMsg = `Nova senha inválida: ${responseData.password.message}`
      } else if (responseData?.passwordConfirm?.message) {
        userMsg = 'A confirmação de senha não confere.'
      } else if (err?.data?.message) {
        userMsg = err.data.message
      } else if (err?.message) {
        userMsg = err.message
      }

      toast.error(userMsg)
    } finally {
      setChangingPassword(false)
    }
  }

  const createdDate = user?.created
    ? new Date(user.created).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'N/D'

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto font-inter text-[#1A1A1A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Painel do Administrador
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-[#1A1A1A] uppercase tracking-tight">
            Perfil do Administrador
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 font-inter mt-1">
            Gerencie os dados cadastrais da sua conta administrativa e credenciais de segurança.
          </p>
        </div>
      </div>

      {/* Cartão de Resumo da Conta Admin */}
      <Card className="bg-white border-2 border-[#D4AF37]/50 p-6 sm:p-8 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <img
                src="https://img.usecurling.com/ppl/large?gender=male&seed=1"
                alt="Avatar Admin"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.25)]"
              />
              <span className="absolute -bottom-1 -right-1 p-1 bg-[#0057FF] text-white rounded-lg shadow-sm">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#0057FF]/15 border border-[#0057FF]/40 text-[#0057FF] font-montserrat">
                  Papel: Administrador Master
                </span>
                <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#9A7B1C] font-montserrat">
                  Plano: {user?.plan ? user.plan.toUpperCase() : 'ADMIN'}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold font-montserrat text-[#1A1A1A] mt-1.5">
                {user?.name || 'Administrador'}
              </h2>
              <p className="text-xs text-gray-600 font-mono mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                {user?.email}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-[#E5E3DC]">
            <div className="text-xs text-gray-500 font-inter flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              Membro desde: <strong className="text-[#1A1A1A]">{createdDate}</strong>
            </div>
            {user?.referral_code && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#F7F5F0] border border-[#E5E3DC] text-xs">
                <span className="text-gray-500 font-montserrat text-[11px] uppercase">
                  Código de Indicação:
                </span>
                <span className="font-mono font-bold text-[#0057FF]">{user.referral_code}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(user.referral_code || '', 'Código de indicação')}
                  className="p-1 hover:text-[#0057FF] text-gray-400"
                  title="Copiar código"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Grid com Dados da Conta + Alteração de Senha */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário: Dados da Conta */}
        <Card className="bg-white border border-[#E5E3DC] p-6 sm:p-7 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-3 border-b border-[#E5E3DC]">
              <div className="p-2 rounded-xl bg-[#0057FF]/10 text-[#0057FF]">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold font-montserrat text-[#1A1A1A] text-base uppercase">
                  Dados da Conta
                </h3>
                <p className="text-xs text-gray-500">
                  Informações de identificação e contato cadastradas no sistema.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 font-montserrat">
                  Nome Completo
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do Administrador"
                  required
                  className="bg-[#F7F5F0] border-[#E5E3DC] text-[#1A1A1A] rounded-xl text-sm font-medium focus-visible:ring-[#0057FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 font-montserrat">
                  E-mail Principal
                </label>
                <Input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-gray-100 border-[#E5E3DC] text-gray-500 rounded-xl text-sm font-mono cursor-not-allowed"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  O e-mail da conta de administrador não pode ser alterado diretamente por aqui.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 font-montserrat">
                  Telefone / WhatsApp
                </label>
                <div className="relative">
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="bg-[#F7F5F0] border-[#E5E3DC] text-[#1A1A1A] rounded-xl text-sm font-medium focus-visible:ring-[#0057FF] pl-9"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-[#F7F5F0] border border-[#E5E3DC]">
                  <span className="text-[10px] font-bold uppercase text-gray-500 font-montserrat block">
                    Papel no Sistema
                  </span>
                  <p className="text-sm font-extrabold text-[#0057FF] font-montserrat uppercase mt-0.5">
                    {user?.role || 'admin'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#F7F5F0] border border-[#E5E3DC]">
                  <span className="text-[10px] font-bold uppercase text-gray-500 font-montserrat block">
                    Plano Ativo
                  </span>
                  <p className="text-sm font-extrabold text-[#9A7B1C] font-montserrat uppercase mt-0.5">
                    {user?.plan || 'Master'}
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={savingAccount}
                  className="w-full bg-[#0057FF] hover:bg-[#0047D4] text-white font-bold text-xs uppercase py-5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {savingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Salvar Dados Cadastrais
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </Card>

        {/* Formulário: Alteração de Senha */}
        <Card className="bg-white border border-[#E5E3DC] p-6 sm:p-7 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-3 border-b border-[#E5E3DC]">
              <div className="p-2 rounded-xl bg-[#D4AF37]/15 text-[#9A7B1C]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold font-montserrat text-[#1A1A1A] text-base uppercase">
                  Alteração de Senha
                </h3>
                <p className="text-xs text-gray-500">
                  Atualize sua credencial de acesso segura ao PocketBase.
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 font-montserrat">
                  Senha Atual
                </label>
                <div className="relative">
                  <Input
                    type={showOldPass ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                    required
                    className="bg-[#F7F5F0] border-[#E5E3DC] text-[#1A1A1A] rounded-xl text-sm font-medium focus-visible:ring-[#D4AF37] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 font-montserrat">
                  Nova Senha
                </label>
                <div className="relative">
                  <Input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    required
                    minLength={8}
                    className="bg-[#F7F5F0] border-[#E5E3DC] text-[#1A1A1A] rounded-xl text-sm font-medium focus-visible:ring-[#D4AF37] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 font-montserrat">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repita a nova senha"
                    required
                    minLength={8}
                    className="bg-[#F7F5F0] border-[#E5E3DC] text-[#1A1A1A] rounded-xl text-sm font-medium focus-visible:ring-[#D4AF37] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  A nova senha deve possuir pelo menos <strong>8 caracteres</strong>. Após a
                  alteração, sua sessão atual permanece autenticada.
                </span>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full bg-[#D4AF37] hover:bg-[#C29E2F] text-black font-extrabold text-xs uppercase py-5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Alterando senha...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Atualizar Senha de Acesso
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  )
}
