I18n.localize();
try{if(sessionStorage.getItem('anishelf-language-settings')){sessionStorage.removeItem('anishelf-language-settings');page='settings';render()}}catch{}

WatchSchedule.start();

AniLists.start();
