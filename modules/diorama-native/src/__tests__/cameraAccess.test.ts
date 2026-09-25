import { getCameraAccess, requestCameraAccess, type CameraAccess } from '../cameraAccess';

const mockNative = {
  getCameraAccess: jest.fn<Promise<CameraAccess>, []>(),
  requestCameraAccess: jest.fn<Promise<CameraAccess>, []>(),
};

jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireNativeModule: () => mockNative,
}));

describe('camera access for head position', () => {
  it('reads the access without asking', async () => {
    mockNative.getCameraAccess.mockResolvedValueOnce('undetermined');
    await expect(getCameraAccess()).resolves.toBe('undetermined');
    expect(mockNative.requestCameraAccess).not.toHaveBeenCalled();
  });

  it('asks, then says what was answered', async () => {
    mockNative.requestCameraAccess.mockResolvedValueOnce('granted');
    await expect(requestCameraAccess()).resolves.toBe('granted');
  });

  it('says so where there is no ARKit (the Simulator)', async () => {
    mockNative.getCameraAccess.mockResolvedValueOnce('unsupported');
    await expect(getCameraAccess()).resolves.toBe('unsupported');
  });
});
