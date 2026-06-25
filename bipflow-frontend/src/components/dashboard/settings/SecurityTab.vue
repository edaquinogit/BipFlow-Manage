<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CheckCircleIcon, ClipboardDocumentIcon, ShieldExclamationIcon } from '@heroicons/vue/24/outline';
import { authService } from '@/services/auth.service';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import { Logger } from '@/services/logger';
import type { MfaSetupResponse } from '@/types/auth';

const { mfaEnabled, fetchCurrentUser } = useCurrentUser();
const { success, error: toastError } = useToast();

// --- MFA setup/disable -----------------------------------------------
const setupData = ref<MfaSetupResponse | null>(null);
const setupCode = ref('');
const isStartingSetup = ref(false);
const isConfirmingSetup = ref(false);
const backupCodes = ref<string[] | null>(null);

const isConfirmingDisable = ref(false);
const disablePassword = ref('');
const isDisablingMfa = ref(false);

const canConfirmSetup = computed(() => !isConfirmingSetup.value && setupCode.value.trim().length > 0);

async function startMfaSetup(): Promise<void> {
  isStartingSetup.value = true;
  try {
    setupData.value = await authService.setupMfa();
  } catch (error: unknown) {
    Logger.error('MFA setup failed to start', { error });
    toastError('Nao foi possivel iniciar a configuracao de MFA agora.');
  } finally {
    isStartingSetup.value = false;
  }
}

async function confirmMfaSetup(): Promise<void> {
  if (!canConfirmSetup.value) return;

  isConfirmingSetup.value = true;
  try {
    const response = await authService.confirmMfaSetup(setupCode.value.trim());
    backupCodes.value = response.backup_codes;
    setupData.value = null;
    setupCode.value = '';
    await fetchCurrentUser();
    success('MFA ativado com sucesso.');
  } catch (error: unknown) {
    Logger.error('MFA setup confirmation failed', { error });
    toastError('Codigo invalido. Confira o app autenticador e tente novamente.');
  } finally {
    isConfirmingSetup.value = false;
  }
}

function cancelMfaSetup(): void {
  setupData.value = null;
  setupCode.value = '';
}

function dismissBackupCodes(): void {
  backupCodes.value = null;
}

async function copyBackupCodes(): Promise<void> {
  if (!backupCodes.value) return;
  try {
    await navigator.clipboard.writeText(backupCodes.value.join('\n'));
    success('Codigos copiados.');
  } catch {
    toastError('Nao foi possivel copiar. Anote os codigos manualmente.');
  }
}

async function confirmDisableMfa(): Promise<void> {
  isDisablingMfa.value = true;
  try {
    await authService.disableMfa(disablePassword.value);
    disablePassword.value = '';
    isConfirmingDisable.value = false;
    await fetchCurrentUser();
    success('MFA desativado.');
  } catch (error: unknown) {
    Logger.error('MFA disable failed', { error });
    toastError('Senha incorreta ou falha ao desativar o MFA.');
  } finally {
    isDisablingMfa.value = false;
  }
}

// --- Logout everywhere --------------------------------------------------
const isConfirmingLogoutAll = ref(false);
const isLoggingOutAll = ref(false);

async function confirmLogoutAllDevices(): Promise<void> {
  isLoggingOutAll.value = true;
  try {
    await authService.logoutAllDevices();
    success('Sessao encerrada em todos os dispositivos.');
    // authService.logoutAllDevices() already redirects to /login.
  } catch (error: unknown) {
    Logger.error('Logout-all-devices failed', { error });
    toastError('Nao foi possivel encerrar as sessoes agora.');
    isLoggingOutAll.value = false;
    isConfirmingLogoutAll.value = false;
  }
}

onMounted(() => {
  void fetchCurrentUser();
});
</script>

<template>
  <section class="max-w-md space-y-4">
    <div class="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Autenticacao</p>
      <h2 class="mt-1 text-sm font-bold text-[#05050A]">Verificacao em duas etapas</h2>
      <p class="mt-2 text-sm leading-6 text-bip-muted">
        Exige um codigo do seu app autenticador (Google Authenticator, Authy etc.) alem da senha
        ao entrar.
      </p>

      <!-- One-time backup codes display, right after confirming setup -->
      <div v-if="backupCodes" class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p class="text-xs font-bold text-amber-900">
          Guarde estes codigos de backup. Eles nao serao mostrados novamente.
        </p>
        <ul class="mt-2 grid grid-cols-2 gap-1.5 font-mono text-xs text-amber-900">
          <li v-for="code in backupCodes" :key="code" class="rounded bg-white/60 px-2 py-1 text-center">
            {{ code }}
          </li>
        </ul>
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-900 transition hover:bg-amber-100"
            @click="copyBackupCodes"
          >
            <ClipboardDocumentIcon class="h-4 w-4" />
            Copiar
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg bg-amber-900 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-amber-800"
            @click="dismissBackupCodes"
          >
            Ja salvei, concluir
          </button>
        </div>
      </div>

      <!-- Setup in progress: QR code + confirmation code -->
      <div v-else-if="setupData" class="mt-4 rounded-lg border border-[#E5E7EB] bg-zinc-50 p-3">
        <div class="flex justify-center">
          <img :src="setupData.qr_code" alt="QR code para configurar o MFA" class="h-40 w-40 rounded-lg border border-[#E5E7EB] bg-white p-2" />
        </div>
        <p class="mt-3 text-center text-xs text-bip-muted">
          Escaneie com seu app autenticador, ou digite manualmente:
        </p>
        <p class="mt-1 break-all rounded bg-white px-2 py-1.5 text-center font-mono text-xs text-[#05050A]">
          {{ setupData.secret }}
        </p>

        <label class="mt-3 block">
          <span class="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-bip-muted">
            Codigo gerado pelo app
          </span>
          <input
            v-model="setupCode"
            type="text"
            inputmode="text"
            placeholder="123456"
            class="h-11 w-full rounded-lg border border-bip-line bg-white px-4 text-center text-lg tracking-[0.3em] text-bip-black shadow-sm transition-colors placeholder:tracking-normal placeholder:text-zinc-400 focus:border-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush"
          />
        </label>

        <div class="mt-3 flex gap-2">
          <button
            type="button"
            :disabled="!canConfirmSetup"
            class="flex-1 rounded-lg bg-[#D81B60] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-300"
            @click="confirmMfaSetup"
          >
            {{ isConfirmingSetup ? 'Confirmando...' : 'Confirmar e ativar' }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bip-muted transition hover:bg-zinc-50"
            @click="cancelMfaSetup"
          >
            Cancelar
          </button>
        </div>
      </div>

      <!-- MFA enabled: status + disable flow -->
      <div v-else-if="mfaEnabled" class="mt-4">
        <div class="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircleIcon class="h-5 w-5 shrink-0 text-emerald-600" />
          MFA ativado nesta conta.
        </div>

        <div v-if="isConfirmingDisable" class="mt-3 rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] p-3">
          <label class="block">
            <span class="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-[#7A143D]">
              Confirme sua senha para desativar
            </span>
            <input
              v-model="disablePassword"
              type="password"
              class="h-10 w-full rounded-lg border border-[#D81B60]/30 bg-white px-3 text-sm text-[#05050A] focus:outline-none focus:ring-2 focus:ring-[#FCE7F3]"
            />
          </label>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              :disabled="isDisablingMfa || !disablePassword"
              class="flex-1 rounded-lg bg-[#D81B60] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-300"
              @click="confirmDisableMfa"
            >
              {{ isDisablingMfa ? 'Desativando...' : 'Desativar MFA' }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bip-muted transition hover:bg-zinc-50"
              @click="isConfirmingDisable = false; disablePassword = ''"
            >
              Cancelar
            </button>
          </div>
        </div>
        <button
          v-else
          type="button"
          class="mt-3 w-full rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-bip-muted transition hover:bg-zinc-50"
          @click="isConfirmingDisable = true"
        >
          Desativar MFA
        </button>
      </div>

      <!-- MFA disabled: offer to enable -->
      <button
        v-else
        type="button"
        :disabled="isStartingSetup"
        class="mt-4 w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-300"
        @click="startMfaSetup"
      >
        {{ isStartingSetup ? 'Gerando...' : 'Ativar verificacao em duas etapas' }}
      </button>
    </div>

    <div class="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Sessoes ativas</p>
      <h2 class="mt-1 text-sm font-bold text-[#05050A]">Encerrar em todos os dispositivos</h2>
      <p class="mt-2 text-sm leading-6 text-bip-muted">
        Revoga o acesso de qualquer navegador ou dispositivo conectado a esta conta, incluindo
        este. Use se suspeitar que sua sessao foi comprometida.
      </p>

      <div
        v-if="isConfirmingLogoutAll"
        class="mt-4 rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] p-3"
      >
        <div class="flex gap-2 text-sm text-[#7A143D]">
          <ShieldExclamationIcon class="h-5 w-5 shrink-0" />
          <p>Voce sera desconectado agora, inclusive desta tela. Confirma?</p>
        </div>
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            :disabled="isLoggingOutAll"
            class="flex-1 rounded-lg bg-[#D81B60] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-300"
            @click="confirmLogoutAllDevices"
          >
            {{ isLoggingOutAll ? 'Encerrando...' : 'Sim, encerrar tudo' }}
          </button>
          <button
            type="button"
            :disabled="isLoggingOutAll"
            class="flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bip-muted transition hover:bg-zinc-50"
            @click="isConfirmingLogoutAll = false"
          >
            Cancelar
          </button>
        </div>
      </div>

      <button
        v-else
        type="button"
        class="mt-4 w-full rounded-lg border border-[#D81B60]/30 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#D81B60] transition hover:bg-[#FCE7F3]"
        @click="isConfirmingLogoutAll = true"
      >
        Sair de todos os dispositivos
      </button>
    </div>
  </section>
</template>
