export const EVENTS = ['knockdowns', 'distance', 'speed', 'woods'];

export const EVENT_LABELS = {
  knockdowns: 'Knockdowns',
  distance: 'Distance',
  speed: 'Speed',
  woods: 'Woods',
};

export const EVENT_LIST = EVENTS.map((key) => ({ key, label: EVENT_LABELS[key] }));
