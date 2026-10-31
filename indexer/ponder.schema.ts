import { onchainTable } from 'ponder'
export const placeholder = onchainTable('placeholder', (t) => ({ id: t.text().primaryKey() }))
