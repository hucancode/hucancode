// Fill out your copyright notice in the Description page of Project Settings.

#include "MyGameInstance.h"
#include "Kismet/GameplayStatics.h"
#include "OnlineSubsystem.h"
#include "OnlineSubsystemUtils.h"

UMyGameInstance::UMyGameInstance()
    : SessionSearch(MakeShared<FOnlineSessionSearch>()) {
  OnCreateSessionCompleteDelegate =
      FOnCreateSessionCompleteDelegate::CreateUObject(
          this, &UMyGameInstance::OnCreateSessionComplete);
  OnStartSessionCompleteDelegate =
      FOnStartSessionCompleteDelegate::CreateUObject(
          this, &UMyGameInstance::OnStartSessionComplete);
  OnFindSessionsCompleteDelegate =
      FOnFindSessionsCompleteDelegate::CreateUObject(
          this, &UMyGameInstance::OnFindSessionsComplete);
  OnJoinSessionCompleteDelegate = FOnJoinSessionCompleteDelegate::CreateUObject(
      this, &UMyGameInstance::OnJoinSessionComplete);
  OnDestroySessionCompleteDelegate =
      FOnDestroySessionCompleteDelegate::CreateUObject(
          this, &UMyGameInstance::OnDestroySessionComplete);
}

UMyGameInstance::~UMyGameInstance() {}

bool UMyGameInstance::CreateSession(const FString HostPlayerName,
    const bool bIsLAN, const bool bIsPresence, const int32 MaxNumPlayers) {
  auto Sessions = GetSessions();
  if (!Sessions) {
    return false;
  }
  this->PlayerName = HostPlayerName;
  /*
  Fill in all the Session Settings that we want to use.

  There are more with SessionSettings.Set(...);
  For example the Map or the GameMode/Type.
  */
  FOnlineSessionSettings Settings;
  Settings.NumPublicConnections = MaxNumPlayers;
  Settings.bShouldAdvertise = true;
  Settings.bAllowJoinInProgress = true;
  Settings.bIsLANMatch = bIsLAN;
  Settings.bUsesPresence = true;
  Settings.bAllowJoinViaPresence = true;
  /* SessionSettings->Set(SETTING_MAPNAME, FString("LegoDungeon"),
   * EOnlineDataAdvertisementType::ViaOnlineService); */

  OnCreateSessionCompleteDelegateHandle =
      Sessions->AddOnCreateSessionCompleteDelegate_Handle(
          OnCreateSessionCompleteDelegate);

  return Sessions->CreateSession(
      *GetPrimaryPlayerUniqueIdRepl(), NAME_GameSession, Settings);
}

void UMyGameInstance::OnCreateSessionComplete(
    FName SessionName, bool bWasSuccessful) {
      *SessionName.ToString(), bWasSuccessful);
  auto Sessions = GetSessions();
  if (!Sessions) {
    return;
  }
  // Clear the SessionComplete delegate handle, since we finished this call
  Sessions->ClearOnCreateSessionCompleteDelegate_Handle(
      OnCreateSessionCompleteDelegateHandle);
  if (!bWasSuccessful) {
    return;
  }
  // Set the StartSession delegate handle
  OnStartSessionCompleteDelegateHandle =
      Sessions->AddOnStartSessionCompleteDelegate_Handle(
          OnStartSessionCompleteDelegate);

  Sessions->StartSession(NAME_GameSession);
}

void UMyGameInstance::OnStartSessionComplete(
    FName SessionName, bool bWasSuccessful) {
      *SessionName.ToString(), bWasSuccessful);
  auto Sessions = GetSessions();
  if (!Sessions) {
    return;
  }
  // Clear the delegate, since we are done with this call
  Sessions->ClearOnStartSessionCompleteDelegate_Handle(
      OnStartSessionCompleteDelegateHandle);
  if (!bWasSuccessful) {
    return;
  }
  TravelToLobby();
}

void UMyGameInstance::TravelToActionMap() {
  // Only lobby host can start game
  if (!GetFirstLocalPlayerController()->HasAuthority()) {
    return;
  }
  GetWorld()->ServerTravel("/Game/Maps/LegoDungeon");
}

void UMyGameInstance::TravelToLobby() {
  UGameplayStatics::OpenLevel(GetWorld(), "Lobby", true, "listen");
}

void UMyGameInstance::TravelToHome() {
  UGameplayStatics::OpenLevel(GetWorld(), "HomeMap", true);
}

void UMyGameInstance::FindSessions(bool bIsLAN, bool bIsPresence) {
  auto Sessions = GetSessions();
  if (!Sessions) {
    OnFindSessionsComplete(false);
    return;
  }
  SessionSearch->bIsLanQuery = bIsLAN;
  SessionSearch->MaxSearchResults = 20;
  SessionSearch->PingBucketSize = 1000;

  // We only want to set this Query Setting if "bIsPresence" is true
  if (bIsPresence) {
    SessionSearch->QuerySettings.Set(
        SEARCH_PRESENCE, bIsPresence, EOnlineComparisonOp::Equals);
  }

  // Set the Delegate to the Delegate Handle of the FindSession function
  OnFindSessionsCompleteDelegateHandle =
      Sessions->AddOnFindSessionsCompleteDelegate_Handle(
          OnFindSessionsCompleteDelegate);

  Sessions->FindSessions(*GetPrimaryPlayerUniqueIdRepl(), SessionSearch);
}

void UMyGameInstance::OnFindSessionsComplete(bool bWasSuccessful) {
  auto Sessions = GetSessions();
  if (!Sessions) {
    return;
  }
  // Clear the Delegate handle, since we finished this call
  Sessions->ClearOnFindSessionsCompleteDelegate_Handle(
      OnFindSessionsCompleteDelegateHandle);
  TArray<FString> Names;
  for (auto result : SessionSearch->SearchResults) {
    Names.Add(result.Session.OwningUserName);
  }
  UpdateSessionList(Names);
}

bool UMyGameInstance::JoinSession(
    ULocalPlayer* LocalPlayer, int32 SessionIndexInSearchResults) {
  if (!LocalPlayer) {
    return false;
  }
  if (SessionSearch->SearchResults.Num() <= SessionIndexInSearchResults) {
    return false;
  }
  return JoinSession(
      LocalPlayer, SessionSearch->SearchResults[SessionIndexInSearchResults]);
}

bool UMyGameInstance::JoinSession(
    ULocalPlayer* LocalPlayer, const FOnlineSessionSearchResult& SearchResult) {
  auto Sessions = GetSessions();
  if (!Sessions || !LocalPlayer) {
    return false;
  }
  // Set the Handle again
  OnJoinSessionCompleteDelegateHandle =
      Sessions->AddOnJoinSessionCompleteDelegate_Handle(
          OnJoinSessionCompleteDelegate);
  return Sessions->JoinSession(
      *LocalPlayer->GetPreferredUniqueNetId().GetUniqueNetId(),
      NAME_GameSession, SearchResult);
}

void UMyGameInstance::OnJoinSessionComplete(
    FName SessionName, EOnJoinSessionCompleteResult::Type Result) {
  // Get the OnlineSubsystem we want to work with
  auto Sessions = GetSessions();
  if (!Sessions) {
    return;
  }
  // Clear the Delegate again
  Sessions->ClearOnJoinSessionCompleteDelegate_Handle(
      OnJoinSessionCompleteDelegateHandle);

  const auto PlayerController = GetFirstLocalPlayerController();

  // We need a FString to use ClientTravel and we can let the
  // SessionInterface contruct such a String for us by giving him the
  // SessionName and an empty String. We want to do this, because Every
  // OnlineSubsystem uses different TravelURLs
  FString TravelURL;

  if (!PlayerController ||
      !Sessions->GetResolvedConnectString(SessionName, TravelURL)) {
    return;
  }
  PlayerController->ClientTravel(TravelURL, ETravelType::TRAVEL_Absolute);
}

void UMyGameInstance::OnDestroySessionComplete(
    FName SessionName, bool bWasSuccessful) {
  auto Sessions = GetSessions();
  if (!Sessions) {
    return;
  }
  // Clear the Delegate
  Sessions->ClearOnDestroySessionCompleteDelegate_Handle(
      OnDestroySessionCompleteDelegateHandle);

  if (!bWasSuccessful) {
    return;
  }
  TravelToHome();
}

void UMyGameInstance::BP_JoinSession(
    const int SessionIndexInSearchResults, FString NewPlayerName) {
  this->PlayerName = NewPlayerName;
  ShowLoadingScreen();
  bool success = JoinSession(GetFirstGamePlayer(), SessionIndexInSearchResults);
  if (!success) {
    TravelToHome();
  }
}

void UMyGameInstance::LeaveSession() {
  auto Sessions = GetSessions();
  if (!Sessions) {
    return;
  }
  Sessions->AddOnDestroySessionCompleteDelegate_Handle(
      OnDestroySessionCompleteDelegate);
  Sessions->DestroySession(NAME_GameSession);
  TravelToHome();
}

IOnlineSessionPtr UMyGameInstance::GetSessions() {
  auto system = Online::GetSubsystem(GetWorld(), NAME_None);
  if (!system) {
    return nullptr;
  }
  auto ret = system->GetSessionInterface();
  if (!ret.IsValid()) {
    return nullptr;
  }
  return ret;
}
