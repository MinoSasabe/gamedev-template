export interface GameSettings {
  playerSpeed: number;
  playerAttack: number;
  playerHp: number;
  playerEnergy: number;
  enemySpeed: number;
  enemyAttack: number;
  enemyHp: number;
  roundTimeSeconds: number;
  timerEnabled: boolean;
}

export type SystemCommandResult = 'applied' | 'ignored' | 'invalid' | 'not-command';
type MultiplierSetting = keyof Pick<
  GameSettings,
  | 'playerSpeed'
  | 'playerAttack'
  | 'playerHp'
  | 'playerEnergy'
  | 'enemySpeed'
  | 'enemyAttack'
  | 'enemyHp'
>;

const DEFAULT_SETTINGS: GameSettings = {
  playerSpeed: 1,
  playerAttack: 1,
  playerHp: 1,
  playerEnergy: 1,
  enemySpeed: 1,
  enemyAttack: 1,
  enemyHp: 1,
  roundTimeSeconds: 60,
  timerEnabled: true,
};

let settings: GameSettings = { ...DEFAULT_SETTINGS };

export function getGameSettings(): Readonly<GameSettings> {
  return settings;
}

export function applySystemCommand(input: string): SystemCommandResult {
  const tokens = input.trim().toLowerCase().split(/\s+/);
  if (tokens[0] !== 'system' && tokens[0] !== 'sys') {
    return 'not-command';
  }

  if (tokens.length === 2 && (tokens[1] === 'default' || tokens[1] === 'def')) {
    settings = { ...DEFAULT_SETTINGS };
    return 'applied';
  }

  if (tokens[1] === 'time' && tokens.length === 3) {
    if (tokens[2] === 'true' || tokens[2] === 'false') {
      settings.timerEnabled = tokens[2] === 'true';
      return 'applied';
    }

    const seconds = Number(tokens[2]);
    if (Number.isFinite(seconds) && seconds > 0) {
      settings.roundTimeSeconds = seconds;
      return 'applied';
    }
    return 'invalid';
  }

  if (tokens.length !== 4) {
    return 'invalid';
  }

  const subject = tokens[1];
  const property = tokens[2];
  const valueText = tokens[3];
  const value = Number(valueText);
  if (!Number.isFinite(value) || value <= 0) {
    return 'invalid';
  }

  if (
    (subject === 'enemy' || subject === 'emy')
    && (property === 'energy' || property === 'eg')
  ) {
    return 'ignored';
  }

  const targetSettings: Record<string, MultiplierSetting> = {
    'player speed': 'playerSpeed',
    'player sp': 'playerSpeed',
    'player attack': 'playerAttack',
    'player at': 'playerAttack',
    'player heart': 'playerHp',
    'player hp': 'playerHp',
    'player energy': 'playerEnergy',
    'player eg': 'playerEnergy',
    'pyr speed': 'playerSpeed',
    'pyr sp': 'playerSpeed',
    'pyr attack': 'playerAttack',
    'pyr at': 'playerAttack',
    'pyr heart': 'playerHp',
    'pyr hp': 'playerHp',
    'pyr energy': 'playerEnergy',
    'pyr eg': 'playerEnergy',
    'enemy speed': 'enemySpeed',
    'enemy sp': 'enemySpeed',
    'enemy attack': 'enemyAttack',
    'enemy at': 'enemyAttack',
    'enemy heart': 'enemyHp',
    'enemy hp': 'enemyHp',
    'emy speed': 'enemySpeed',
    'emy sp': 'enemySpeed',
    'emy attack': 'enemyAttack',
    'emy at': 'enemyAttack',
    'emy heart': 'enemyHp',
    'emy hp': 'enemyHp',
  };
  const settingKey = targetSettings[`${subject} ${property}`];
  if (!settingKey) {
    return 'invalid';
  }

  settings[settingKey] = value;
  return 'applied';
}
