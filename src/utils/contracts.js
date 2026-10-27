// Player contracts: a `contract` entity per club player, linked both ways.
//
//   contract.CustomData = { player_id, club_id, wage, length_periods, periods_left, signed_week }
//   player.CustomData.contract_id = contract.ItemId   ('' for free agents / juniors)
//
// The game (CatalogProvider._validate_contracts) refuses a catalog where the links are
// not mutual, club_id is not the bundle holding the player, a bundled player has no
// contract, or the numbers are out of range. The helpers here mirror those rules so
// the editor shows the same problems before the game does.

export const CONTRACT_CLASS = 'contract'
export const DEFAULT_CONTRACT_PERIODS = 13 // data/finance_rules.json default_contract_periods
export const PAY_PERIOD_WEEKS = 4

export function parseData(entity) {
  if (!entity?.CustomData) return {}
  try {
    const parsed = JSON.parse(entity.CustomData)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function toInt(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : NaN
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return parseInt(value, 10)
  return NaN
}

// The club bundle that lists this player (null for free agents / juniors)
export function findClubOfPlayer(playerId, allItems) {
  return allItems.find(e =>
    e.ItemClass === 'club' && Array.isArray(e.Bundle?.BundledItems) &&
    e.Bundle.BundledItems.includes(playerId)
  ) || null
}

// Every contract whose player_id points at this player (normally one or none)
export function findContractsOfPlayer(playerId, allItems) {
  return allItems.filter(e =>
    e.ItemClass === CONTRACT_CLASS && parseData(e).player_id === playerId
  )
}

// Starting-contract defaults: wage equals catalog power, a full year, signed before the game
export function defaultContractData(player, club) {
  const power = toInt(parseData(player).power)
  return {
    player_id: player?.ItemId || '',
    club_id: club?.ItemId || '',
    wage: Number.isInteger(power) && power > 0 ? power : 1,
    length_periods: DEFAULT_CONTRACT_PERIODS,
    periods_left: DEFAULT_CONTRACT_PERIODS,
    signed_week: 0
  }
}

export function defaultContractName(player) {
  return `Контракт ${player?.DisplayName || player?.ItemId || ''}`.trim()
}

export function defaultContractDescription(club) {
  return club
    ? `Стартовый контракт игрока клуба ${club.DisplayName || club.ItemId}`
    : 'Контракт игрока'
}

// Problems with a contract entity's own data and its links
export function contractIssues(contract, allItems) {
  const issues = []
  const data = parseData(contract)
  const byId = new Map(allItems.map(i => [i.ItemId, i]))

  const player = data.player_id ? byId.get(data.player_id) : null
  if (!data.player_id) {
    issues.push({ severity: 'error', message: 'Не указан игрок (player_id)' })
  } else if (!player || player.ItemClass !== 'player') {
    issues.push({ severity: 'error', message: `Игрок «${data.player_id}» не найден` })
  } else if (parseData(player).contract_id !== contract.ItemId) {
    issues.push({
      severity: 'error',
      message: `У игрока ${player.ItemId} contract_id = «${parseData(player).contract_id || ''}», а не ${contract.ItemId}`
    })
  }

  const club = data.club_id ? byId.get(data.club_id) : null
  if (!data.club_id) {
    issues.push({ severity: 'error', message: 'Не указан клуб (club_id)' })
  } else if (!club || club.ItemClass !== 'club') {
    issues.push({ severity: 'error', message: `Клуб «${data.club_id}» не найден` })
  } else if (player && !club.Bundle?.BundledItems?.includes(player.ItemId)) {
    const actual = findClubOfPlayer(player.ItemId, allItems)
    issues.push({
      severity: 'error',
      message: actual
        ? `Игрок лежит в бандле ${actual.ItemId}, а не ${club.ItemId}`
        : `Игрок не лежит в бандле клуба ${club.ItemId}`
    })
  }

  const wage = toInt(data.wage)
  const length = toInt(data.length_periods)
  const left = toInt(data.periods_left)
  const signed = toInt(data.signed_week)

  if (!Number.isInteger(wage) || wage <= 0) {
    issues.push({ severity: 'error', message: 'wage: нужно целое число > 0' })
  }
  if (!Number.isInteger(length) || length < 1) {
    issues.push({ severity: 'error', message: 'length_periods: нужно целое число ≥ 1' })
  }
  if (!Number.isInteger(left) || left < 1 || (Number.isInteger(length) && left > length)) {
    issues.push({ severity: 'error', message: 'periods_left: целое от 1 до length_periods' })
  }
  if (data.signed_week !== undefined && (!Number.isInteger(signed) || signed < 0)) {
    issues.push({ severity: 'error', message: 'signed_week: целое число ≥ 0' })
  }

  for (const key of ['wage', 'length_periods', 'periods_left', 'signed_week']) {
    if (typeof data[key] === 'string') {
      issues.push({ severity: 'warning', message: `${key} записан строкой — лучше числом` })
      break
    }
  }

  return issues
}

// Problems with a player's side of the link
export function playerContractIssues(player, allItems) {
  const issues = []
  const data = parseData(player)
  const club = findClubOfPlayer(player.ItemId, allItems)
  const contractId = data.contract_id

  if (contractId) {
    const contract = allItems.find(e => e.ItemId === contractId)
    if (!contract || contract.ItemClass !== CONTRACT_CLASS) {
      issues.push({ severity: 'error', message: `Контракт «${contractId}» не найден` })
    } else if (parseData(contract).player_id !== player.ItemId) {
      issues.push({
        severity: 'error',
        message: `Контракт ${contractId} выписан на другого игрока (${parseData(contract).player_id || '—'})`
      })
    }
  } else if (club) {
    issues.push({
      severity: 'error',
      message: `Игрок в бандле ${club.ItemId}, но без контракта — игра не загрузит каталог`
    })
  }

  const others = findContractsOfPlayer(player.ItemId, allItems).filter(c => c.ItemId !== contractId)
  if (others.length > 0) {
    issues.push({
      severity: 'warning',
      message: `На игрока также указывают: ${others.map(c => c.ItemId).join(', ')}`
    })
  }

  return issues
}

export function contractIssuesForEntity(entity, allItems) {
  if (entity.ItemClass === CONTRACT_CLASS) return contractIssues(entity, allItems)
  if (entity.ItemClass === 'player') return playerContractIssues(entity, allItems)
  return []
}

// Short badge text for a player card: "13п · $2" (periods, wage)
export function contractSummary(contract) {
  const data = parseData(contract)
  const left = toInt(data.periods_left)
  const length = toInt(data.length_periods)
  const wage = toInt(data.wage)
  const term = Number.isInteger(left) && Number.isInteger(length) && left !== length
    ? `${left}/${length}`
    : `${Number.isInteger(length) ? length : '?'}`
  return `${term}п · $${Number.isInteger(wage) ? wage : '?'}`
}
