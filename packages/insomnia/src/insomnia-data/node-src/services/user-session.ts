import { database as db, models, type UserSession } from '~/insomnia-data';

const { type } = models.userSession;

export async function all() {
  let userList = await db.find<UserSession>(type);

  if (userList?.length === 0) {
    userList = [await getOrCreate()];
  }

  return userList;
}

async function create() {
  const user = await db.docCreate<UserSession>(type);
  return user;
}

export async function update(user: UserSession, patch: Partial<UserSession>) {
  const updatedUser = await db.docUpdate<UserSession>(user, patch);
  return updatedUser;
}

export async function patch(patch: Partial<UserSession>) {
  const user = await getOrCreate();
  const updatedUser = await db.docUpdate<UserSession>(user, patch);
  return updatedUser;
}

export async function getOrCreate() {
  const result = await db.findOne<UserSession>(type);

  if (!result) {
    return await create();
  }
  return result;
}

export async function get() {
  return getOrCreate();
}
