// Generate a unique nickname
const generateNickname = (existingNicknames) => {
    const adjectives = [
      "Swift", "Brave", "Bright", "Clever", "Calm", "Gentle", "Noble", "Fierce",
      "Quick", "Happy", "Mighty", "Bold", "Wise", "Lucky", "Daring", "Kind",
      "Sly", "Quiet", "Shy", "Loyal", "Eager", "Strong", "Zesty", "Sharp"
    ];
    const nouns = [
      "Fox", "Hawk", "Lion", "Bear", "Wolf", "Falcon", "Tiger", "Eagle",
      "Panther", "Otter", "Raven", "Panda", "Cougar", "Shark", "Lynx", "Badger",
      "Dragon", "Phoenix", "Falcon", "Cheetah", "Jaguar", "Cobra", "Viper", "Stag"
    ];
  
    let nickname;
    do {
      const randomAdjective1 = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomAdjective2 = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const randomNumber = Math.floor(Math.random() * 10000); // Add 4-digit uniqueness
      nickname = `${randomAdjective1}${randomAdjective2}${randomNoun}${randomNumber}`;
    } while (existingNicknames.has(nickname)); // Ensure no duplicates
  
    existingNicknames.add(nickname); // Mark as used
    return nickname;
  };
  
  export default generateNickname;
  