<template>
  <div class="game-sync">
    <button
      v-if="isConfigured && hasData"
      @click="handleSave"
      :disabled="isBusy"
      class="btn-game btn-save"
      :title="`Сохранить данные в ${displayPath} (Ctrl+S)`"
    >
      <span v-if="hasUnsavedChanges" class="dirty-dot" title="Есть несохранённые изменения"></span>
      Сохранить в игру
    </button>
    <button
      v-else-if="isConfigured && !hasData"
      @click="handleLoad"
      :disabled="isBusy"
      class="btn-game btn-save"
      :title="`Загрузить данные из ${displayPath}`"
    >
      Открыть из игры
    </button>
    <button
      @click="dialogVisible = true"
      class="btn-game btn-project"
      :class="{ 'needs-setup': !isConfigured }"
      title="Куда сохраняются данные"
    >
      {{ isConfigured ? '📂' : '📂 Подключить проект игры' }}
    </button>
    <span v-if="lastError" class="sync-status sync-err" :title="lastError">{{ firstLine(lastError) }}</span>
    <span v-else-if="lastStatus" class="sync-status sync-ok" :title="lastStatus">{{ lastStatus }}</span>

    <!-- Setup / explanation dialog -->
    <div v-if="dialogVisible" class="modal-overlay game-dialog-overlay" @click.self="dialogVisible = false">
      <div class="game-dialog">
        <div class="dialog-header">
          <h2>Проект игры</h2>
          <button @click="dialogVisible = false" class="close-btn">x</button>
        </div>

        <div class="dialog-body">
          <p>
            Редактор сохраняет геймдизайн-данные <strong>прямо в репозиторий игры</strong>.
            Игра (и сервер, и клиент) читает их при запуске — PlayFab для данных больше не нужен.
          </p>

          <div class="step">
            <div class="step-num">1</div>
            <div>
              <div class="step-title">Выберите корневую папку проекта игры</div>
              <div class="step-desc">
                Ту, где лежит <code>project.godot</code> — обычно <code>C:\Work\FCM_2</code>.
                Это делается один раз, браузер запомнит папку.
              </div>
            </div>
          </div>

          <div class="step">
            <div class="step-num">2</div>
            <div>
              <div class="step-title">Нажимайте «Сохранить в игру» (или Ctrl+S)</div>
              <div class="step-desc">
                Данные записываются в <code>data/catalog/</code> внутри проекта:
                <ul class="file-list">
                  <li><code>index.json</code> — список файлов, которые загружает игра</li>
                  <li><code>location.json</code>, <code>player.json</code>, <code>club.json</code>… — по файлу на каждый тип сущности</li>
                </ul>
                Перезаписываются только изменившиеся файлы.
              </div>
            </div>
          </div>

          <div class="step">
            <div class="step-num">3</div>
            <div>
              <div class="step-title">Закоммитьте изменения в git проекта игры</div>
              <div class="step-desc">
                В диффе видно, что именно поменялось. Чтобы изменения попали в игру, её нужно пересобрать.
              </div>
            </div>
          </div>

          <p class="hint">
            Картинки сохраняются отдельно: Settings → Data → Image Folder.
          </p>

          <div class="folder-box">
            <div v-if="!isSupported()" class="folder-warn">
              Этот браузер не поддерживает доступ к папкам. Используйте Chrome или Edge.
            </div>
            <template v-else>
              <div v-if="isConfigured">
                Сохранение в: <code>{{ displayPath }}</code>
                <span v-if="!permissionGranted" class="folder-warn">
                  — доступ будет запрошен заново при сохранении
                </span>
              </div>
              <div v-else class="folder-empty">Папка ещё не выбрана.</div>
            </template>
          </div>

          <div class="dialog-actions">
            <button @click="handlePick" class="btn btn-primary" :disabled="!isSupported() || isBusy">
              {{ isConfigured ? 'Сменить папку' : 'Выбрать папку проекта' }}
            </button>
            <button
              v-if="isConfigured"
              @click="handleLoad"
              class="btn btn-secondary"
              :disabled="isBusy"
              title="Заменить данные в редакторе содержимым data/catalog"
            >
              Открыть из игры
            </button>
            <button v-if="isConfigured" @click="handleForget" class="btn btn-warning" :disabled="isBusy">
              Забыть папку
            </button>
          </div>
          <div v-if="lastError" class="dialog-error">{{ lastError }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameProject } from '../composables/useGameProject'
import { usePlayFabData } from '../composables/usePlayFabData'

const {
  isSupported,
  isConfigured,
  displayPath,
  permissionGranted,
  isBusy,
  lastStatus,
  lastError,
  hasUnsavedChanges,
  init,
  pickFolder,
  forgetFolder,
  saveToGame,
  loadFromGame
} = useGameProject()
const { state } = usePlayFabData()

const dialogVisible = ref(false)
const hasData = computed(() => state.catalogData !== null)

function firstLine(text) {
  return String(text).split('\n')[0]
}

async function handlePick() {
  try {
    const name = await pickFolder()
    if (!name) return
    if (!hasData.value) {
      // Fresh session: offer to open what the game already has
      await handleLoad({ silent: true })
    }
  } catch (e) {
    if (e.name !== 'AbortError') alert(e.message)
  }
}

async function handleForget() {
  if (!confirm('Забыть папку проекта игры? Файлы на диске не удаляются.')) return
  await forgetFolder()
}

async function handleSave() {
  try {
    await saveToGame()
  } catch (e) {
    alert(e.message)
  }
}

async function handleLoad({ silent = false } = {}) {
  if (hasData.value && !silent) {
    const ok = confirm('Загрузить данные из проекта игры? Текущее состояние редактора будет заменено.')
    if (!ok) return
  }
  try {
    await loadFromGame()
    dialogVisible.value = false
  } catch (e) {
    if (!silent) alert(e.message)
  }
}

function handleKeydown(e) {
  if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) return
  e.preventDefault()
  if (!hasData.value || isBusy.value) return
  if (!isConfigured.value) {
    dialogVisible.value = true
    return
  }
  // An open edit modal holds changes not yet applied to the catalog
  if (document.querySelector('.modal-overlay:not(.game-dialog-overlay)')) {
    lastStatus.value = ''
    lastError.value = 'Сначала сохраните или закройте окно редактирования'
    return
  }
  handleSave()
}

onMounted(() => {
  init()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.game-sync {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-game {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: white;
  transition: background 0.15s, opacity 0.15s;
}

.btn-save {
  background: #2563eb;
}
.btn-save:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-project {
  background: #475569;
}
.btn-project:hover {
  background: #334155;
}
.btn-project.needs-setup {
  background: #2563eb;
}

.btn-game:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fbbf24;
}

.sync-status {
  font-size: 12px;
  padding: 4px 8px;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sync-ok { color: #34d399; }
.sync-err { color: #f87171; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.game-dialog {
  background: white;
  color: #1e293b;
  border-radius: 12px;
  width: 600px;
  max-width: 94vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}
.dialog-header h2 {
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #64748b;
}

.dialog-body {
  padding: 16px 20px 20px;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.step {
  display: flex;
  gap: 12px;
}

.step-num {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #2563eb;
  color: white;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-title {
  font-weight: 600;
}

.step-desc {
  color: #475569;
  font-size: 13px;
}

.file-list {
  margin: 4px 0 4px 18px;
}

code {
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}

.hint {
  color: #64748b;
  font-size: 13px;
}

.folder-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}

.folder-warn { color: #b45309; }
.folder-empty { color: #64748b; }

.dialog-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: #2563eb; color: white; }
.btn-secondary { background: #e2e8f0; color: #1e293b; }
.btn-warning { background: #fef3c7; color: #92400e; }

.dialog-error {
  color: #dc2626;
  font-size: 13px;
  white-space: pre-wrap;
}
</style>
