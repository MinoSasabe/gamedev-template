export enum GameState {
  Title = 'title',
  Playing = 'playing',
  Paused = 'paused',
  Clear = 'clear',
  GameOver = 'game-over',
}

export enum GameEvent {
  EnterPressed = 'enter-pressed',
  EscapePressed = 'escape-pressed',
  TimerExpired = 'timer-expired',
  PlayerDefeated = 'player-defeated',
  AllKeysCollected = 'all-keys-collected',
}

export function transitionGameState(
  state: GameState,
  event: GameEvent,
): GameState {
  if (state === GameState.Title && event === GameEvent.EnterPressed) {
    return GameState.Playing;
  }

  if (state === GameState.Playing) {
    if (event === GameEvent.EscapePressed) {
      return GameState.Paused;
    }
    if (event === GameEvent.TimerExpired) {
      return GameState.GameOver;
    }
    if (event === GameEvent.PlayerDefeated) {
      return GameState.GameOver;
    }
    if (event === GameEvent.AllKeysCollected) {
      return GameState.Clear;
    }
  }

  if (state === GameState.Paused && event === GameEvent.EscapePressed) {
    return GameState.Playing;
  }

  if (state === GameState.GameOver && event === GameEvent.EnterPressed) {
    return GameState.Title;
  }

  if (state === GameState.Clear && event === GameEvent.EnterPressed) {
    return GameState.Title;
  }

  return state;
}