type LiquidGlassModule = typeof import('../liquidGlass');

/** What the (mocked) expo-glass-effect checks report on this "device". */
const mockDevice = { liquidGlass: true, glassAPI: true, throws: false, checks: 0 };

jest.mock('expo-glass-effect', () => ({
  __esModule: true,
  ...jest.requireActual('expo-glass-effect'),
  isLiquidGlassAvailable: () => {
    mockDevice.checks += 1;
    if (mockDevice.throws) throw new Error('ExpoGlassEffect native module is missing');
    return mockDevice.liquidGlass;
  },
  isGlassEffectAPIAvailable: () => mockDevice.glassAPI,
}));

/** A fresh copy of liquidGlass.ts, like a cold launch on a device like `device`. */
function launchOn(device: Partial<typeof mockDevice>): LiquidGlassModule {
  Object.assign(mockDevice, { liquidGlass: true, glassAPI: true, throws: false, checks: 0 });
  Object.assign(mockDevice, device);
  let loaded: LiquidGlassModule | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<LiquidGlassModule>('../liquidGlass');
  });
  if (!loaded) throw new Error('launchOn() failed to load liquidGlass');
  return loaded;
}

describe('canUseLiquidGlass', () => {
  it('is true on iOS 26 with the glass API', () => {
    expect(launchOn({}).canUseLiquidGlass()).toBe(true);
  });

  it('is false before iOS 26', () => {
    expect(launchOn({ liquidGlass: false }).canUseLiquidGlass()).toBe(false);
  });

  // Some iOS 26 betas shipped the design without the API.
  it('is false on an iOS 26 beta without the glass API', () => {
    expect(launchOn({ glassAPI: false }).canUseLiquidGlass()).toBe(false);
  });

  it('is false, not a crash, when the check throws', () => {
    expect(launchOn({ throws: true }).canUseLiquidGlass()).toBe(false);
  });

  it('checks the device once and remembers the answer', () => {
    const { canUseLiquidGlass } = launchOn({});

    canUseLiquidGlass();
    mockDevice.liquidGlass = false;

    expect(canUseLiquidGlass()).toBe(true);
    expect(mockDevice.checks).toBe(1);
  });
});
