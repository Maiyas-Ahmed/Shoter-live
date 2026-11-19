import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDamage,
  evaluateOnlineRoomReadiness,
  resolveRoundOutcome,
  resolveCircleBoxCollisions,
  rayIntersectsBox,
  rayIntersectsTargetCylinder,
  normalizeTag4,
  generateRoomCode,
  getSpawnPoint,
  ARENA_OBSTACLES,
} from './rules';

test('First-to-5 Lone Wolf rule allows full comeback from 4-0 to 4-5', () => {
  let scoreA = 4;
  let scoreB = 0;

  // Team B wins 4 rounds in a row to tie 4-4
  for (let i = 0; i < 4; i++) {
    const res = resolveRoundOutcome({
      scoreA,
      scoreB,
      teamAAlive: 0,
      teamBAlive: 1,
      elapsedSec: 20,
    });
    assert.equal(res.roundEnded, true);
    assert.equal(res.roundWinner, 'B');
    assert.equal(res.matchEnded, false);
    scoreA = res.newScoreA;
    scoreB = res.newScoreB;
  }
  assert.equal(scoreA, 4);
  assert.equal(scoreB, 4);

  // Team B wins the 5th round -> 4-5 Victory for B!
  const finalRes = resolveRoundOutcome({
    scoreA,
    scoreB,
    teamAAlive: 0,
    teamBAlive: 1,
    elapsedSec: 22,
  });
  assert.equal(finalRes.roundEnded, true);
  assert.equal(finalRes.newScoreB, 5);
  assert.equal(finalRes.matchEnded, true);
  assert.equal(finalRes.matchWinner, 'B');
});

test('Timeout resolves round to team with more survivors or draw', () => {
  const tie = resolveRoundOutcome({
    scoreA: 2,
    scoreB: 2,
    teamAAlive: 1,
    teamBAlive: 1,
    elapsedSec: 60,
  });
  assert.equal(tie.roundEnded, true);
  assert.equal(tie.roundWinner, 'draw');
  assert.equal(tie.newScoreA, 2);
  assert.equal(tie.newScoreB, 2);

  const aWins = resolveRoundOutcome({
    scoreA: 4,
    scoreB: 3,
    teamAAlive: 2,
    teamBAlive: 1,
    elapsedSec: 60,
  });
  assert.equal(aWins.roundWinner, 'A');
  assert.equal(aWins.matchEnded, true);
  assert.equal(aWins.matchWinner, 'A');
});

test('Damage calculation applies headshot multiplier and armor mitigation', () => {
  const body = applyDamage({
    hp: 200,
    armor: 100,
    rawDamage: 32,
    isHeadshot: false,
    headshotMult: 2.35,
  });
  assert.equal(body.armor, 89); // 35% of 32 = 11 absorbed
  assert.equal(body.hp, 179); // 21 HP damage
  assert.equal(body.alive, true);

  const sniperHead = applyDamage({
    hp: 150,
    armor: 0,
    rawDamage: 98,
    isHeadshot: true,
    headshotMult: 2.2,
  });
  assert.equal(sniperHead.hp, 0);
  assert.equal(sniperHead.alive, false);
});

test('Ray intersection hits cover box and blocks shots behind it', () => {
  const box = { x: 0, y: 0, z: 0, w: 4, h: 3, d: 2 };
  const hitWall = rayIntersectsBox(0, 1.5, -10, 0, 0, 1, 50, box);
  assert.ok(hitWall !== null && Math.abs(hitWall - 9) < 0.01);

  const target = rayIntersectsTargetCylinder(0, 1.56, -10, 0, 0, 1, 50, 0, 0, 10);
  assert.ok(target !== null);
  assert.equal(target.isHeadshot, true);
  assert.ok(hitWall! < target.dist, 'Wall is closer than enemy target');
});

test('Circle-box collision pushes player outside obstacle and keeps spawn clear', () => {
  const pushed = resolveCircleBoxCollisions(0, 0, 0.55, [{ x: 0, y: 0, z: 0, w: 4, h: 3, d: 4 }]);
  const distFromCenter = Math.max(Math.abs(pushed.x), Math.abs(pushed.z));
  assert.ok(distFromCenter >= 2.54);

  const spawnA = getSpawnPoint('A', 0);
  const spawnACollision = resolveCircleBoxCollisions(spawnA.x, spawnA.z, 0.55, ARENA_OBSTACLES);
  assert.equal(spawnACollision.x, spawnA.x);
  assert.equal(spawnACollision.z, spawnA.z);
});

test('4-digit tag normalization and room codes match rules format', () => {
  assert.equal(normalizeTag4('42'), '4200');
  assert.equal(normalizeTag4('123456'), '1234');
  assert.match(normalizeTag4(''), /^[0-9]{4}$/);
  assert.match(generateRoomCode('LW'), /^LW[2-9A-Z]{4}$/);
});

test('Online readiness blocks solo players and bots, only allowing real opposing humans', () => {
  const solo = evaluateOnlineRoomReadiness({
    mode: '1v1',
    isPrivate: false,
    participants: [{ team: 'A', isBot: false }],
  });
  assert.equal(solo.canStart, false);

  const withBot = evaluateOnlineRoomReadiness({
    mode: '1v1',
    isPrivate: false,
    participants: [
      { team: 'A', isBot: false },
      { team: 'B', isBot: true },
    ],
  });
  assert.equal(withBot.canStart, false);

  const matched1v1 = evaluateOnlineRoomReadiness({
    mode: '1v1',
    isPrivate: false,
    participants: [
      { team: 'A', isBot: false },
      { team: 'B', isBot: false },
    ],
  });
  assert.equal(matched1v1.canStart, true);

  const partial2v2Quick = evaluateOnlineRoomReadiness({
    mode: '2v2',
    isPrivate: false,
    participants: [
      { team: 'A', isBot: false },
      { team: 'B', isBot: false },
    ],
  });
  assert.equal(partial2v2Quick.canStart, false);

  const custom2v2Ready = evaluateOnlineRoomReadiness({
    mode: '2v2',
    isPrivate: true,
    participants: [
      { team: 'A', isBot: false },
      { team: 'B', isBot: false },
    ],
  });
  assert.equal(custom2v2Ready.canStart, true);
});
