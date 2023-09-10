// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "Interfaces/OnlineSessionInterface.h"
#include "OnlineSessionSettings.h"
#include "MyGameInstance.generated.h"

/**
 *
 */
UCLASS()
class UMyGameInstance : public UGameInstance {
  GENERATED_BODY()

 public:
  UMyGameInstance();
  ~UMyGameInstance();
  /* virtual void BeginPlay() override; */
  void OnCreateSessionComplete(FName SessionName, bool bWasSuccessful);
  void OnStartSessionComplete(FName SessionName, bool bWasSuccessful);
  void OnFindSessionsComplete(bool bWasSuccessful);
  void OnJoinSessionComplete(
      FName SessionName, EOnJoinSessionCompleteResult::Type Result);
  void OnDestroySessionComplete(FName SessionName, bool bWasSuccessful);

  virtual bool JoinSession(
      ULocalPlayer* LocalPlayer, int32 SessionIndexInSearchResults) override;
  virtual bool JoinSession(ULocalPlayer* LocalPlayer,
      const FOnlineSessionSearchResult& SearchResult) override;

  UFUNCTION(BlueprintCallable, DisplayName = CreateSession)
  bool CreateSession(const FString HostPlayerName, bool bIsLAN,
      bool bIsPresence, const int32 MaxNumPlayers);
  UFUNCTION(BlueprintCallable, DisplayName = FindSessions)
  void FindSessions(bool bIsLAN, bool bIsPresence);
  UFUNCTION(BlueprintCallable, DisplayName = LeaveSession)
  void LeaveSession();
  UFUNCTION(BlueprintImplementableEvent, DisplayName = ShowLoadingScreen)
  void ShowLoadingScreen();
  UFUNCTION(BlueprintImplementableEvent, DisplayName = UpdateSessionList)
  void UpdateSessionList(const TArray<FString>& Results);
  UFUNCTION(BlueprintCallable, DisplayName = TravelToActionMap)
  void TravelToActionMap();
  /* UFUNCTION(Broadcast, Unreliable) */
  /* void PreGameStartSetup(); */
  UFUNCTION(BlueprintCallable, DisplayName = TravelToLobby)
  void TravelToLobby();
  UFUNCTION(BlueprintCallable, DisplayName = TravelToHome)
  void TravelToHome();

  UFUNCTION(BlueprintCallable, DisplayName = JoinSession)
  void BP_JoinSession(
      const int SessionIndexInSearchResults, FString NewPlayerName);

  FString PlayerName;
  TSharedRef<FOnlineSessionSearch> SessionSearch;
  FOnCreateSessionCompleteDelegate OnCreateSessionCompleteDelegate;
  FOnStartSessionCompleteDelegate OnStartSessionCompleteDelegate;
  FOnFindSessionsCompleteDelegate OnFindSessionsCompleteDelegate;
  FOnJoinSessionCompleteDelegate OnJoinSessionCompleteDelegate;
  FOnDestroySessionCompleteDelegate OnDestroySessionCompleteDelegate;
  FDelegateHandle OnCreateSessionCompleteDelegateHandle;
  FDelegateHandle OnStartSessionCompleteDelegateHandle;
  FDelegateHandle OnFindSessionsCompleteDelegateHandle;
  FDelegateHandle OnJoinSessionCompleteDelegateHandle;
  FDelegateHandle OnDestroySessionCompleteDelegateHandle;

 private:
  IOnlineSessionPtr GetSessions();
};

