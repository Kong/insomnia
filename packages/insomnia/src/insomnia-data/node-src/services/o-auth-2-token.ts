import { database as db, models, type OAuth2Token } from '~/insomnia-data';

const { type } = models.oAuth2Token;

export function create(patch: Partial<OAuth2Token> = {}) {
  if (!patch.parentId) {
    throw new Error(`New OAuth2Token missing \`parentId\` ${JSON.stringify(patch)}`);
  }

  return db.docCreate<OAuth2Token>(type, patch);
}

export function update(token: OAuth2Token, patch: Partial<OAuth2Token>) {
  return db.docUpdate(token, patch);
}

export function remove(token: OAuth2Token) {
  return db.remove(token);
}

export function getByParentId(parentId: string) {
  return db.findOne<OAuth2Token>(type, { parentId });
}

export async function getOrCreateByParentId(parentId: string) {
  let token = await db.findOne<OAuth2Token>(type, {
    parentId,
  });

  if (!token) {
    token = await create({
      parentId,
    });
  }

  return token;
}

export function all() {
  return db.find<OAuth2Token>(type);
}
