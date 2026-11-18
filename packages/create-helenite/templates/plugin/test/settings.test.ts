import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, withDefaults } from '../src/settings';

describe('withDefaults', () => {
  it('gives the defaults on the first run, when there is no data.json', () => {
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps saved values and fills in the rest', () => {
    const s = withDefaults({ greetings: [{ id: '1', text: 'Hi' }] });
    expect(s.greetings).toEqual([{ id: '1', text: 'Hi' }]);
    expect(s.helloOnStart).toBe(false);
  });

  it('never hands out the default greetings array itself', () => {
    withDefaults(null).greetings.push({ id: 'x', text: 'x' });
    expect(DEFAULT_SETTINGS.greetings).toHaveLength(1);
  });
});
