const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const { GoogleGenerativeAI } = require("@google/generative-ai");

// const genAI = new GoogleGenerativeAI("");

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY, // This is the default and can be omitted
});

// Function to generate the dynamic AI prompt
const generateDynamicPrompt = (subject, chapter, topic) => {
  const prompt = `
As an expert educator in ${subject}, provide a comprehensive explanation of the topic "${topic}" from the chapter "${chapter}". Your explanation should:

1. Start with a clear, concise definition or introduction to the topic.
2. Explain the key concepts, principles, or theories related to this topic.
3. Provide relevant examples, analogies, or real-world applications to illustrate the topic.
4. If applicable, include any important formulas, equations, or diagrams (described in text).
5. Discuss any historical context or significant developments related to this topic.
6. Highlight the importance or relevance of this topic within the broader subject area.
7. Address common misconceptions or difficulties students might have with this topic.
8. Give diagrams in Markdown format as much as possible.

Your explanation should be suitable for a ${
    subject === "11" ? "11th" : "12th"
  } grade student, balancing depth of content with clarity of explanation. Aim for an engaging and informative response.
`;

  return prompt;
};

// Function to generate AI content using the prompt
async function generateAIContent(subject, chapter, topic) {
  const prompt = generateDynamicPrompt(subject, chapter, topic);
  // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [{ type: "tool", text: prompt }],
      },
    ],
  });
  try {
    // const result = await model.generateContent(prompt);
    return {
      // content: result.response.text(), // AI-generated content
      // fullResponse: result.response.text(), // Full response from the API
      content: response.choices[0].message.content, // AI-generated content
      fullResponse: response.choices[0].message.content, // Full response from the API
    };
  } catch (error) {
    console.error("Error generating content from AI:", error);
    return {
      content: `Error generating content for topic: ${topic}`, // Placeholder in case of an error
      fullResponse: null,
    };
  }
}

// Function to process a single chapter
async function processChapter(
  subject,
  chapterData,
  chapterName,
  outputFilePath,
  responseFilePath
) {
  // Prepare the structure for output content
  const chapterOutput = {
    chapter: chapterData[0].chapter,
    topics: [],
  };

  const responseOutput = [];

  // Process each topic in the chapter and generate AI content
  for (const topic of chapterData[0].topics) {
    const { content, fullResponse } = await generateAIContent(
      subject,
      chapterData[0].chapter,
      topic
    );

    chapterOutput.topics.push({
      name: topic,
      content: `${content}`,
    });

    responseOutput.push({
      topic,
      fullResponse: fullResponse ? fullResponse.toString() : "No response",
    });
  }

  // Write the chapter with topic content to a JSON file
  fs.writeFileSync(outputFilePath, JSON.stringify(chapterOutput, null, 2));
  console.log(
    `Generated content for chapter: ${chapterName} in subject: ${subject}`
  );

  // Write the full AI responses to a separate JSON file
  fs.writeFileSync(responseFilePath, JSON.stringify(responseOutput, null, 2));
  console.log(
    `Saved AI responses for chapter: ${chapterName} in subject: ${subject}`
  );
}

// Function to process syllabus in a queue-like manner
async function processSyllabus(
  folderPath,
  outputFolderPath,
  responseFolderPath
) {
  try {
    const subjects = fs.readdirSync(folderPath);
    const queue = []; // This will serve as the queue to handle each AI call sequentially

    for (const subject of subjects) {
      const subjectFolderPath = path.join(folderPath, subject);
      const outputSubjectFolderPath = path.join(outputFolderPath, subject);
      const responseSubjectFolderPath = path.join(responseFolderPath, subject);

      // Ensure the output and response subject folders exist
      if (!fs.existsSync(outputSubjectFolderPath)) {
        fs.mkdirSync(outputSubjectFolderPath, { recursive: true });
      }
      if (!fs.existsSync(responseSubjectFolderPath)) {
        fs.mkdirSync(responseSubjectFolderPath, { recursive: true });
      }

      const chapters = fs.readdirSync(subjectFolderPath);

      for (const chapterFile of chapters) {
        const chapterFilePath = path.join(subjectFolderPath, chapterFile);
        const chapterName = path.parse(chapterFile).name;
        const outputFilePath = path.join(
          outputSubjectFolderPath,
          `${chapterName}.json`
        );
        const responseFilePath = path.join(
          responseSubjectFolderPath,
          `resp${chapterName.slice(-1)}.json`
        );

        // Read each chapter JSON file
        const data = fs.readFileSync(chapterFilePath, "utf8");
        const chapterData = JSON.parse(data);

        // Push the processing of each chapter into the queue
        queue.push(async () => {
          await processChapter(
            subject,
            chapterData,
            chapterName,
            outputFilePath,
            responseFilePath
          );
        });
      }
    }

    // Execute the queue sequentially
    for (const task of queue) {
      await task(); // Each task runs one after another, waiting for the previous one to finish
    }
  } catch (err) {
    console.error(`Error processing syllabus: ${err}`);
  }
}

// Define the source and output paths
const syllabusFolder = path.join(__dirname, "syllabus");
const outputFolder = path.join(__dirname, "content");
const responseFolder = path.join(__dirname, "response");

// Ensure the output and response folders exist
if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder, { recursive: true });
}
if (!fs.existsSync(responseFolder)) {
  fs.mkdirSync(responseFolder, { recursive: true });
}

// Process both folders (11 and 12) for content and AI responses
processSyllabus(
  path.join(syllabusFolder, "11"),
  path.join(outputFolder, "11"),
  path.join(responseFolder, "11")
);
processSyllabus(
  path.join(syllabusFolder, "12"),
  path.join(outputFolder, "12"),
  path.join(responseFolder, "12")
);
