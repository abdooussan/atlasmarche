// Manage accounts from the command line (you, the admin).
//
// On the server, in the deploy folder:
//   docker compose exec api npm run user -- list                    all accounts (newest first)
//   docker compose exec api npm run user -- pending                 Premium requested, not active yet
//   docker compose exec api npm run user -- paid client@mail.ma     activate Premium with no end date
//   docker compose exec api npm run user -- paid client@mail.ma 12  activate Premium for 12 months
//   docker compose exec api npm run user -- unpaid client@mail.ma   turn Premium off
//   docker compose exec api npm run user -- reset client@mail.ma    new temporary password (printed)
//
// On your computer, in api/: the same commands with "npm run user -- ...".
import crypto from 'node:crypto';
import { hashPassword, normalizeEmail } from './auth.js';
import { authQuery, closeAuth } from './authDb.js';

const [cmd, emailArg, monthsArg] = process.argv.slice(2);

function table(rows) {
  if (!rows.length) return console.log('(aucun compte)');
  console.table(
    rows.map((r) => ({
      email: r.email,
      nom: r.name,
      entreprise: r.company,
      premium: r.premium ? 'oui' : 'non',
      'fin premium': r.paid_until ? r.paid_until.toISOString().slice(0, 10) : '',
      'demande WhatsApp': r.premium_requested_at ? r.premium_requested_at.toISOString().slice(0, 16).replace('T', ' ') : '',
      inscrit: r.created_at.toISOString().slice(0, 10),
    })),
  );
}

const COLS = `email, name, company, paid_until, premium_requested_at, created_at,
  (is_paid AND (paid_until IS NULL OR paid_until > now())) AS premium`;

function needEmail() {
  const email = normalizeEmail(emailArg);
  if (!email) {
    console.error('Indiquez une adresse e-mail valide, par exemple : npm run user -- paid client@mail.ma');
    process.exit(1);
  }
  return email;
}

async function update(sql, params, done) {
  const { rows } = await authQuery(sql, params);
  if (!rows.length) {
    console.error(`Aucun compte avec l'adresse ${params[0]}`);
    process.exitCode = 1;
    return;
  }
  console.log(done);
  table(rows);
}

try {
  switch (cmd) {
    case 'list': {
      const { rows } = await authQuery(`SELECT ${COLS} FROM app_users ORDER BY created_at DESC LIMIT 200`);
      table(rows);
      break;
    }
    case 'pending': {
      const { rows } = await authQuery(
        `SELECT ${COLS} FROM app_users
         WHERE premium_requested_at IS NOT NULL AND NOT (is_paid AND (paid_until IS NULL OR paid_until > now()))
         ORDER BY premium_requested_at DESC`,
      );
      table(rows);
      break;
    }
    case 'paid': {
      const email = needEmail();
      const months = monthsArg ? Number(monthsArg) : null;
      if (months !== null && !(Number.isInteger(months) && months > 0)) {
        console.error('Le nombre de mois doit être un entier positif, par exemple 12.');
        process.exit(1);
      }
      await update(
        `UPDATE app_users SET is_paid = true,
           paid_until = CASE WHEN $2::int IS NULL THEN NULL ELSE now() + make_interval(months => $2::int) END
         WHERE email = $1 RETURNING ${COLS}`,
        [email, months],
        months ? `Premium activé pour ${months} mois.` : 'Premium activé (sans date de fin).',
      );
      break;
    }
    case 'unpaid': {
      const email = needEmail();
      await update(
        `UPDATE app_users SET is_paid = false, paid_until = NULL WHERE email = $1 RETURNING ${COLS}`,
        [email],
        'Premium désactivé.',
      );
      break;
    }
    case 'reset': {
      const email = needEmail();
      const temp = crypto.randomBytes(6).toString('base64url') + '7';
      const { rows } = await authQuery(
        `UPDATE app_users SET password_hash = $2 WHERE email = $1 RETURNING id`,
        [email, await hashPassword(temp)],
      );
      if (!rows.length) {
        console.error(`Aucun compte avec l'adresse ${email}`);
        process.exitCode = 1;
        break;
      }
      // Log the account out on every phone.
      await authQuery('UPDATE app_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [rows[0].id]);
      console.log(`Nouveau mot de passe temporaire pour ${email} :\n\n    ${temp}\n\nEnvoyez-le au client (WhatsApp) et demandez-lui de se connecter.`);
      break;
    }
    default:
      console.log('Commandes : list | pending | paid <email> [mois] | unpaid <email> | reset <email>');
      process.exitCode = cmd ? 1 : 0;
  }
} finally {
  await closeAuth();
}
