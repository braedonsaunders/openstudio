# ASIO SDK Setup

Download the ASIO SDK from Steinberg and extract the required folders here.

## Steps

1. Go to https://www.steinberg.net/developers/
2. Download "ASIO SDK" (requires free account)
3. Extract the zip file
4. Copy these folders into this directory:

```
native-bridge/asio-sdk/
├── README.md        ← (this file, already here)
├── common/          ← REQUIRED - copy this folder
│   ├── asio.h
│   ├── asio.cpp
│   ├── asiodrivers.cpp
│   ├── asiodrivers.h
│   ├── asiodrvr.h
│   ├── asiolist.cpp
│   ├── asiolist.h
│   ├── asiosys.h
│   ├── combase.cpp
│   ├── combase.h
│   ├── dllentry.cpp
│   ├── iasiodrv.h
│   └── register.cpp
└── host/            ← REQUIRED - copy this folder
    ├── asiodrivers.cpp
    ├── asiodrivers.h
    ├── ginclude.h
    └── pc/
        └── asiolist.cpp
```

## What's NOT needed

- `asio/` folder - sample projects, not needed
- `driver/` folder - for building ASIO drivers, not needed

## Quick Copy

From your extracted SDK folder, just copy:
```bash
cp -r ASIOSDK/common native-bridge/asio-sdk/
cp -r ASIOSDK/host native-bridge/asio-sdk/
```

## After Adding

Commit and push. GitHub Actions will detect the SDK and build with ASIO support automatically.
