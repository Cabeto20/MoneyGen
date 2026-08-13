let lastId = 0;

export const generateId = () => {
  const now = Date.now();
  lastId = now > lastId ? now : lastId + 1;
  return lastId;
};
