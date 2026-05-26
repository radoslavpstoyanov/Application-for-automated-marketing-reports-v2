-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProjectSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "oauthConnectionId" TEXT,
    "externalAccountId" TEXT NOT NULL,
    "externalAccountName" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectSource_oauthConnectionId_fkey" FOREIGN KEY ("oauthConnectionId") REFERENCES "OAuthConnection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProjectSource" ("createdAt", "externalAccountId", "externalAccountName", "id", "isEnabled", "oauthConnectionId", "projectId", "sourceType", "updatedAt") SELECT "createdAt", "externalAccountId", "externalAccountName", "id", "isEnabled", "oauthConnectionId", "projectId", "sourceType", "updatedAt" FROM "ProjectSource";
DROP TABLE "ProjectSource";
ALTER TABLE "new_ProjectSource" RENAME TO "ProjectSource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
