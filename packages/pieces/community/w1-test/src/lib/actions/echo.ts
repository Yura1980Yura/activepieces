import { createAction, Property } from '@activepieces/pieces-framework';

export const echoAction = createAction({
  name: 'echo',
  displayName: 'Echo',
  description: 'Returns the input message as output — for testing',
  props: {
    message: Property.ShortText({
      displayName: 'Message',
      description: 'The message to echo back',
      required: true,
    }),
  },
  async run(context) {
    const message = context.propsValue['message'];
    return {
      message,
      timestamp: new Date().toISOString(),
      source: 'w1-test-piece',
    };
  },
});
