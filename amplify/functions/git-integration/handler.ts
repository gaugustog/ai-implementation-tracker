export const handler = async (event: any) => {
  console.log('Git Integration Lambda - Event:', JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Git Integration Lambda - Placeholder',
      event,
    }),
  };
};
