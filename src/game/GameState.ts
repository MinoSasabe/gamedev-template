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
  ReturnToTitlePressed = 'return-to-title-pressed',
  TimerExpired = 'timer-expired',
  PlayerDefeated = 'player-defeated',
  ExitDoorCrossed = 'exit-door-crossed',
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
    if (event === GameEvent.ExitDoorCrossed) {
      return GameState.Clear;
    }
  }

  if (state === GameState.Paused && event === GameEvent.EscapePressed) {
    return GameState.Playing;
  }

  if (state === GameState.Paused && event === GameEvent.ReturnToTitlePressed) {
    return GameState.Title;
  }

  if (state === GameState.GameOver && event === GameEvent.EnterPressed) {
    return GameState.Title;
  }

  if (state === GameState.Clear && event === GameEvent.EnterPressed) {
    return GameState.Title;
  }

  return state;
}