/** The exact text a creator signs to authorise an image change (shared by client and server). */
export function imageEditMessage(address: string, imageUrl: string, timestamp: number) {
  return `Meridian: set image for pool ${address}\n${imageUrl}\n${timestamp}`;
}

/** The exact text a wallet signs to post a comment (shared by client and server). */
export function commentMessage(poolAddress: string, body: string, timestamp: number) {
  return `Meridian: comment on pool ${poolAddress}\n${body}\n${timestamp}`;
}
