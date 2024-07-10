import RequestManager from '../src/managers/qsys/RequestManager';
import EventManager from '../src/managers/event/EventManager';

describe('RequestManager', () => {
  let requestManager: RequestManager;
  let mockEventManager: EventManager;

  beforeEach(() => {
    // Mock the EventManager since it's a dependency of RequestManager
    mockEventManager = new EventManager();
    jest.spyOn(mockEventManager, 'on').mockImplementation();

    // Initialize RequestManager with the mocked EventManager
    requestManager = new RequestManager(mockEventManager);
  });

  describe('createChangeRequest', () => {
    it('should add a change request to the changeRequestIds array', () => {
      const componentName = 'TestComponent';
      const requestId = '123';
      const onChangeRequest = jest.fn();

      // Call the method under test
      requestManager.createChangeRequest(componentName, requestId, onChangeRequest);

      // Access the private changeRequestIds array via any to verify the change request was added
      const changeRequestIds = (requestManager as any).changeRequestIds;

      expect(changeRequestIds).toHaveLength(1);
      expect(changeRequestIds[0]).toEqual({
        id: requestId,
        component: componentName,
        onChangeRequest
      });
    });
  });
});