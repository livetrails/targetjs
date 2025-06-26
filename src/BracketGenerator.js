import { Bracket } from "./Bracket.js";
/**
 * Generates a bottom-up tree from the children of a TModel. When the number of children
 * exceeds a defined threshold (bracketThreshold), a tree is generated to limit the process loop to only
 * the visible branches. A TModel can opt out of tree generation completely by defining a target
 * `shouldBeBracketed` and setting it to false.
 */
class BracketGenerator {

    static bracketMap = {};
    static pageMap = {}
    static all = {}

    static generate(page, regenerate = false) {
        let brackets = BracketGenerator.bracketMap[page.oid];

        if (!brackets || BracketGenerator.pageMap[page.oid] !== page.allChildrenList || regenerate) {
            BracketGenerator.bracketMap[page.oid] = BracketGenerator.buildTreeBottomUp(page, page.getChildren());
            BracketGenerator.pageMap[page.oid] = page.allChildrenList;
        } else {
            if (page.lastChildrenUpdate.deletions.length > 0) {
                BracketGenerator.updateTreeOnDeletions(page, page.lastChildrenUpdate.deletions);
                BracketGenerator.reindexTree(page);
            }
            
            if (page.lastChildrenUpdate.additions.length > 0) {
                BracketGenerator.updateTreeOnAdditions(page, page.lastChildrenUpdate.additions);              
            }
            
            if (page.lastChildrenUpdate.deletions.length > 0 || page.lastChildrenUpdate.additions.length > 0) {
                BracketGenerator.reindexTree(page);
            }
        }

        page.lastChildrenUpdate.additions.length = 0;
        page.lastChildrenUpdate.deletions.length = 0;
        
        return BracketGenerator.bracketMap[page.oid];
    }

    static updateTreeOnDeletions(page, deletions) {           
        function deleteChildRecursively(parent, child) {
            if (!parent) {
                return;
            }
            
            if (child instanceof Bracket && child.parent === child.realParent) {
                const topBrackets = BracketGenerator.bracketMap[page.oid];
                const index = topBrackets.indexOf(child);
                if (index >= 0) {
                    topBrackets.splice(index, 1);
                }
            } else {
                const index = parent.allChildrenList.indexOf(child);
                if (index >= 0) {
                    parent.allChildrenList.splice(index, 1);
                    if (parent.allChildrenList.length === 0) {
                        deleteChildRecursively(parent.parent, parent);
                    }
                }
            }
        }
   
        deletions.forEach(child => deleteChildRecursively(child.bracket, child));
        
    } 
    
    static reindexTree(page) {
        const topBrackets = BracketGenerator.bracketMap[page.oid];

        function reindexBracket(bracket, currentIndex) {
            if (bracket.allChildrenList.length === 0) {
                return currentIndex;
            }

            const containsBrackets = bracket.allChildrenList[0] instanceof Bracket;
            if (containsBrackets) {
                bracket.startIndex = currentIndex;
                for (const child of bracket.allChildrenList) {
                    currentIndex = reindexBracket(child, currentIndex);
                }
                bracket.endIndex = currentIndex;
            } else {
                bracket.startIndex = currentIndex;
                currentIndex += bracket.allChildrenList.length;
                bracket.endIndex = currentIndex;
            }

            return currentIndex;
        }

        let currentIndex = 0;
        for (const topBracket of topBrackets) {
            currentIndex = reindexBracket(topBracket, currentIndex);
        }
    }


    static updateTreeOnAdditions(page, additions) {
        const bracketSize = page.getBracketSize();

        additions.forEach(({ index, child }) => {
            const targetBracket = BracketGenerator.findOrCreateBracket(page, index);
            const newIndex = index - targetBracket.startIndex;
            if (newIndex < targetBracket.allChildrenList.length) {
                targetBracket.allChildrenList.splice(newIndex, 0, child);
            } else {
                targetBracket.allChildrenList.push(child);
            }
            child.bracket = targetBracket;
            
            let bracket = targetBracket;            
            bracket.startIndex = Math.min(bracket.startIndex, index);
            bracket.endIndex = bracket.startIndex + bracket.allChildrenList.length;  
            bracket.currentStatus = 'new';

            bracket = targetBracket.getParent();
            while (bracket instanceof Bracket) {
                bracket.startIndex = Math.min(bracket.startIndex, index);
                bracket.endIndex = Math.max(bracket.endIndex, index + 1);
                bracket.currentStatus = 'new';                
                bracket = bracket.getParent();
            }

            if (targetBracket.allChildrenList.length > bracketSize) {
                BracketGenerator.splitBracket(page, targetBracket);
            }
        });
    }

    static splitBracket(page, bracket) {
        const list = bracket.allChildrenList;
        const bracketSize = page.getBracketSize();

        const chunks = [];
        let startIndex = bracket.startIndex;

        for (let i = 0; i < list.length; i += bracketSize) {
            const chunk = list.slice(i, i + bracketSize);
            const endIndex = startIndex + chunk.length;
            const newBracket = BracketGenerator.createBracket(page, startIndex, endIndex, chunk);
            newBracket.parent = bracket.parent;
            
            startIndex = newBracket.endIndex;
            chunks.push(newBracket);
        }
  
        if (bracket.parent !== bracket.realParent) {
            const index = bracket.parent.allChildrenList.indexOf(bracket);
            if (index >= 0) {
                bracket.parent.allChildrenList.splice(index, 1, ...chunks);
            }
            
            if (bracket.parent.allChildrenList.length >= bracketSize) {
                const rebuiltChildren = BracketGenerator.buildTreeBottomUp(page, bracket.parent.allChildrenList);          
                bracket.parent.allChildrenList = rebuiltChildren;
                                
                bracket.parent.allChildrenList.forEach(child => {
                    child.parent = bracket.parent;
                });
                
                // Update grandparent relationships
                if (bracket.parent.parent) {
                    const parentIndex = bracket.parent.parent.allChildrenList.indexOf(bracket.parent);
                    if (parentIndex >= 0) {
                        bracket.parent.parent.allChildrenList.splice(parentIndex, 1, ...rebuiltChildren);
                        bracket.parent.parent.allChildrenList.forEach(child => {
                            child.parent = bracket.parent.parent;
                        });
                                        
                    }
                }
            }           
        } else {
            const topBrackets = BracketGenerator.bracketMap[page.oid];
            const index = topBrackets.indexOf(bracket);
            if (index >= 0) {
                topBrackets.splice(index, 1, ...chunks);
            }

            if (topBrackets.length > page.getBracketSize()) {
                BracketGenerator.bracketMap[page.oid] = BracketGenerator.buildTreeBottomUp(page, topBrackets);
            }
        }
    }

    static findOrCreateBracket(page, index, brackets = BracketGenerator.bracketMap[page.oid]) {
        for (const bracket of brackets) {
            if (bracket.startIndex <= index && bracket.endIndex >= index) {
                if (bracket.getFirstChild() instanceof Bracket) {
                    return BracketGenerator.findOrCreateBracket(page, index, bracket.allChildrenList);
                }
                return bracket;
            }
        }

        const newBracket = BracketGenerator.createBracket(page, index, index);
        brackets.push(newBracket);

        if (brackets.length > page.getBracketSize()) {
            const topBrackets = BracketGenerator.buildTreeBottomUp(page, brackets);
            BracketGenerator.bracketMap[page.oid].brackets = topBrackets;
        }

        return newBracket;
    }

    static buildTreeBottomUp(page, list) {
        const length = list.length;
        const bracketSize = page.getBracketSize();
        const brackets = [];

        for (let i = 0; i < length; i += bracketSize) {
            const chunk = list.slice(i, i + bracketSize);
            const containsBrackets = chunk[0] instanceof Bracket;
            const startIndex = containsBrackets ? chunk[0].startIndex : i;
            const endIndex = containsBrackets ? chunk[chunk.length - 1].endIndex : (i + chunk.length);
            const bracket = BracketGenerator.createBracket(page, startIndex, endIndex, chunk);
          
            brackets.push(bracket);
        }

        return brackets.length > bracketSize ? BracketGenerator.buildTreeBottomUp(page, brackets) : brackets;
    }

    static createBracket(page, startIndex, endIndex, list) {
        const bracket = new Bracket(page);
        bracket.realParent = page;

        bracket.allChildrenList = list || bracket.allChildrenList;
        bracket.startIndex = startIndex;
        bracket.endIndex = endIndex;

        bracket.allChildrenList.forEach(child => {
            if (child instanceof Bracket) {
                child.realParent = page;
                child.parent = bracket;
            } else {
                child.bracket = bracket;
            }
        });

        BracketGenerator.all[bracket.oid] = bracket;

        return bracket;
    }
}

export { BracketGenerator };
