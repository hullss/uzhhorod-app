import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { CITY_POLL, CITY_POLLS, isAppointment, isPollVote, MAX_APPOINTMENTS, type Appointment, type PollVote } from "../civic/demoCivic";

const APPOINTMENTS_KEY = "uzhhorod-digital.cnap.v1";
const VOTE_KEY = "uzhhorod-digital.poll-v1";
let pendingWrite = Promise.resolve();

async function read(key: string): Promise<unknown> {
  await pendingWrite.catch(() => undefined);
  const serialized = Platform.OS === "web" ? globalThis.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  if (!serialized) return null;
  // Corrupted data is reported to the user rather than silently replaced by an empty history.
  return JSON.parse(serialized);
}

function write(key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  const task = pendingWrite.catch(() => undefined).then(async () => {
    if (Platform.OS === "web") globalThis.localStorage.setItem(key, serialized);
    else await SecureStore.setItemAsync(key, serialized, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  });
  pendingWrite = task;
  return task;
}

export async function restoreAppointments(): Promise<Appointment[]> {
  const value = await read(APPOINTMENTS_KEY);
  if (value === null) return [];
  if (!Array.isArray(value) || !value.every(isAppointment)) throw new Error("Не вдалося прочитати збережені записи.");
  return value.slice(0, MAX_APPOINTMENTS);
}
export function persistAppointments(items: Appointment[]): Promise<void> {
  // Whitelist fields: this store never retains contact details or arbitrary form data.
  return write(APPOINTMENTS_KEY, items.slice(0, MAX_APPOINTMENTS).map(({ id, serviceId, centerId, date, time, createdAt, cancelledAt }) =>
    ({ id, serviceId, centerId, date, time, createdAt, ...(cancelledAt ? { cancelledAt } : {}) })));
}
const voteKey = (pollId: string) => pollId === CITY_POLL.id ? VOTE_KEY : `uzhhorod-digital.poll.${pollId}`;
export async function restoreVote(pollId: string = CITY_POLL.id): Promise<PollVote | null> {
  const value = await read(voteKey(pollId));
  if (value === null) return null;
  if (!isPollVote(value) || value.pollId !== pollId) throw new Error("Не вдалося прочитати збережений голос.");
  return value;
}
export function persistVote({ pollId, optionId, votedAt }: PollVote): Promise<void> {
  if (!isPollVote({ pollId, optionId, votedAt })) return Promise.reject(new Error("Перевірте голос."));
  return write(voteKey(pollId), { pollId, optionId, votedAt });
}
export async function restoreVotes(): Promise<PollVote[]> {
  const votes = await Promise.all(CITY_POLLS.map(poll => restoreVote(poll.id)));
  return votes.filter((vote): vote is PollVote => vote !== null);
}
