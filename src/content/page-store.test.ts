import { describe, expect, it } from "vitest";
import {
  applyPageStoreRelationships,
  harvestUsersFromPayload,
  readPageUserRelationships,
} from "./page-store";
import { scanXDocument, type ExtractedCandidate } from "./x-adapter";

function fixture(body: string): Document {
  return new DOMParser().parseFromString(`<html><body>${body}</body></html>`, "text/html");
}

function attachStore(
  doc: Document,
  entities: Record<string, unknown>,
): void {
  const host = doc.createElement("div");
  const child = doc.createElement("div");
  host.id = "react-root";
  host.append(child);
  doc.body.prepend(host);
  Object.defineProperty(child, "__reactProps$test", {
    configurable: true,
    value: {
      children: {
        props: {
          children: {
            props: {
              store: {
                getState: () => ({
                  entities: {
                    users: {
                      entities,
                    },
                  },
                }),
              },
            },
          },
        },
      },
    },
  });
}

describe("page store relationships", () => {
  it("reads following and followed_by from the already-loaded UI store", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="User-Name"><a href="/Alice/status/1"><span>Alice Example</span></a></div>
    </article>`);
    attachStore(doc, {
      "1": { screen_name: "Alice", following: true, followed_by: false },
    });

    const users = readPageUserRelationships(doc);
    expect(users.get("alice")).toMatchObject({
      handle: "Alice",
      following: true,
      followsYou: false,
    });
  });

  it("reads GraphQL-shaped user entities and blocked_by", () => {
    const doc = fixture("<div id='react-root'><div></div></div>");
    const host = doc.querySelector("#react-root > div");
    Object.defineProperty(host, "__reactProps$test", {
      value: {
        store: {
          getState: () => ({
            entities: {
              users: {
                entities: {
                  "9": {
                    legacy: { screen_name: "Blocked" },
                    relationship_perspectives: {
                      following: false,
                      followed_by: false,
                    },
                    blocked_by: true,
                  },
                },
              },
            },
          }),
        },
      },
    });

    expect(readPageUserRelationships(doc).get("blocked")).toMatchObject({
      handle: "Blocked",
      blockedBy: true,
    });
  });

  it("turns an evidence-less home card into a following-only observation", () => {
    const doc = fixture(`<div data-testid="SideNav_AccountSwitcher_Button"><span>@Viewer</span></div>
      <article data-testid="tweet">
        <div data-testid="User-Name"><a href="/Alice/status/1"><span>Alice Example</span></a></div>
      </article>`);
    attachStore(doc, {
      "1": { screen_name: "Alice", following: true, followed_by: false },
    });
    const candidates = scanXDocument(doc, "https://x.com/home", 100);
    applyPageStoreRelationships(candidates, readPageUserRelationships(doc));

    expect(candidates[0]?.observation).toMatchObject({
      handle: "Alice",
      relationship: "following_only",
      evidence: ["page-user-entity"],
    });
  });

  it("does not invent a relationship when the store omits followsYou", () => {
    const observation = {
      observation: {
        userKey: "alice",
        handle: "Alice",
        displayName: "Alice",
        avatarUrl: null,
        profileUrl: "https://x.com/Alice",
        observedAt: 1,
        sourceUrl: "https://x.com/home",
        sourceType: "timeline" as const,
        relationship: "unknown" as const,
        evidence: ["insufficient-evidence" as const],
      },
      anchor: document.createElement("div"),
    } satisfies ExtractedCandidate;

    applyPageStoreRelationships([observation], new Map([
      ["alice", { handle: "Alice", following: true, followsYou: null, blockedBy: null }],
    ]));

    expect(observation.observation.relationship).toBe("unknown");
  });

  it("does not let the page store override already collectable DOM evidence", () => {
    const observation = {
      observation: {
        userKey: "alice",
        handle: "Alice",
        displayName: "Alice",
        avatarUrl: null,
        profileUrl: "https://x.com/Alice",
        observedAt: 1,
        sourceUrl: "https://x.com/home",
        sourceType: "timeline" as const,
        relationship: "mutual" as const,
        evidence: ["following-control" as const, "follows-you-label" as const],
      },
      anchor: document.createElement("div"),
    } satisfies ExtractedCandidate;

    applyPageStoreRelationships([observation], new Map([
      ["alice", {
        handle: "Alice",
        following: true,
        followsYou: false,
        blockedBy: null,
      }],
    ]));

    expect(observation.observation).toMatchObject({
      relationship: "mutual",
      evidence: ["following-control", "follows-you-label"],
    });
  });

  it("still reads reply authors from tweet fibers when the store already has the viewer", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="User-Name"><a href="/ReplyAuthor/status/2"><span>Reply Author</span></a></div>
    </article>`);
    attachStore(doc, {
      viewer: { screen_name: "Viewer", following: false, followed_by: false },
    });
    const article = doc.querySelector("article");
    Object.defineProperty(article, "__reactFiber$test", {
      value: {
        memoizedProps: { className: "host" },
        return: {
          memoizedProps: {
            tweet: {
              core: {
                user_results: {
                  result: {
                    legacy: {
                      screen_name: "ReplyAuthor",
                      following: true,
                      followed_by: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const users = readPageUserRelationships(doc);
    expect(users.get("viewer")?.handle).toBe("Viewer");
    expect(users.get("replyauthor")).toMatchObject({
      handle: "ReplyAuthor",
      following: true,
      followsYou: true,
    });
  });

  it("harvests reply authors from an already-loaded TweetDetail payload", () => {
    const users = harvestUsersFromPayload({
      data: {
        threaded_conversation_with_injections_v2: {
          instructions: [{
            entries: [
              {
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        __typename: "Tweet",
                        core: {
                          user_results: {
                            result: {
                              legacy: {
                                screen_name: "MainAuthor",
                                following: true,
                                followed_by: false,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              {
                content: {
                  items: [{
                    item: {
                      itemContent: {
                        tweet_results: {
                          result: {
                            core: {
                              user_results: {
                                result: {
                                  relationship_perspectives: {
                                    following: false,
                                    followed_by: true,
                                  },
                                  legacy: { screen_name: "ReplyAuthor" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  }],
                },
              },
            ],
          }],
        },
      },
    });

    expect(users.get("mainauthor")).toMatchObject({
      handle: "MainAuthor",
      following: true,
      followsYou: false,
    });
    expect(users.get("replyauthor")).toMatchObject({
      handle: "ReplyAuthor",
      following: false,
      followsYou: true,
    });
  });

  it("reads a tweet fiber user when the root store is missing", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="User-Name"><a href="/Alice/status/1"><span>Alice Example</span></a></div>
    </article>`);
    const article = doc.querySelector("article");
    Object.defineProperty(article, "__reactFiber$test", {
      value: {
        memoizedProps: {
          tweet: {
            core: {
              user_results: {
                result: {
                  legacy: { screen_name: "Alice", following: true, followed_by: true },
                },
              },
            },
          },
        },
      },
    });

    expect(readPageUserRelationships(doc).get("alice")).toMatchObject({
      handle: "Alice",
      following: true,
      followsYou: true,
    });
  });
});
